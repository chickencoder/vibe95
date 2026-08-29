import { DurableObject } from 'cloudflare:workers'
import type { Env } from './env'

const OPENROUTER = 'https://openrouter.ai/api/v1'
const CLEANUP_AFTER_MS = 60 * 60 * 1000
const PERSIST_EVERY_CHARS = 4096

type JobStatus = 'idle' | 'running' | 'done' | 'error'

interface JobMeta {
  userId: string
  status: JobStatus
  error?: string
}

type StreamEvent =
  | { t: 'snap'; text: string }
  | { t: 'd'; c: string }
  | { t: 'think'; n: number }
  | { t: 'reset' } // a silent retry started over — discard received text
  | { t: 'done' }
  | { t: 'err'; m: string }

const MAX_ATTEMPTS = 3
const MAX_CONTINUATIONS = 3

// Mirrors src/protocol.ts (the worker build does not import from src/).
// A valid response ends with "=== END ===" and contains at least one
// FILE/EDIT/DELETE section; anything else is a refusal, apology, or truncation.
const END_RE = /^[ \t]*={2,5}\s*END\s*={2,5}[ \t]*$/m
const SECTION_RE = /^[ \t]*={2,5}\s*(FILE|EDIT|DELETE)\s*:/m

// ~20k tokens of visible reasoning with no output yet: the model is
// thinking itself past its own output budget. Cut it off and retry.
const THINK_CAP_CHARS = 80_000

const NO_OVERTHINK_PROMPT =
  'Think very briefly this time. Start writing the response immediately, ' +
  'beginning with the NAME header and the FILE sections, and keep ' +
  'any planning to a few sentences.'

const CONTINUE_PROMPT =
  'Your previous message was cut off before === END ===. Continue EXACTLY from ' +
  'the last character you wrote: no commentary, no repetition, no restarting ' +
  'the file. Just keep going and finish, ending with === END ==='

/**
 * One Durable Object per generation. The OpenRouter stream runs here, on the
 * server, so the client can disconnect (refresh, tab close, flaky wifi) and
 * re-attach at any offset without losing the generation.
 */
export class GenerationJob extends DurableObject<Env> {
  private text = ''
  private status: JobStatus = 'idle'
  private errorMsg = ''
  private userId = ''
  private loaded = false
  private lastPersisted = 0
  private listeners = new Set<(ev: StreamEvent) => void>()

  private async load() {
    if (this.loaded) return
    this.loaded = true
    const [text, meta] = await Promise.all([
      this.ctx.storage.get<string>('text'),
      this.ctx.storage.get<JobMeta>('meta'),
    ])
    this.text = text ?? ''
    if (meta) {
      this.userId = meta.userId
      this.status = meta.status
      this.errorMsg = meta.error ?? ''
      // If we were mid-run when the DO restarted, the upstream stream is gone.
      if (this.status === 'running') {
        this.status = 'error'
        this.errorMsg = 'The generation was interrupted on the server. Please try again.'
        await this.ctx.storage.put('meta', this.meta())
      }
    }
  }

  private meta(): JobMeta {
    return { userId: this.userId, status: this.status, error: this.errorMsg || undefined }
  }

  async start(
    userId: string,
    model: string,
    messages: { role: string; content: string }[]
  ): Promise<{ ok: boolean; error?: string }> {
    await this.load()
    if (this.status !== 'idle') {
      return { ok: this.status === 'running' || this.status === 'done' }
    }
    this.status = 'running'
    this.userId = userId
    await this.ctx.storage.put('meta', this.meta())
    await this.ctx.storage.setAlarm(Date.now() + CLEANUP_AFTER_MS)
    // Keep the DO alive for the duration of the upstream stream.
    this.ctx.waitUntil(this.run(model, messages))
    return { ok: true }
  }

  async getMeta(): Promise<JobMeta> {
    await this.load()
    return this.meta()
  }

  private notify(ev: StreamEvent) {
    for (const l of [...this.listeners]) l(ev)
  }

  private async append(delta: string) {
    this.text += delta
    this.notify({ t: 'd', c: delta })
    if (this.text.length - this.lastPersisted >= PERSIST_EVERY_CHARS) {
      this.lastPersisted = this.text.length
      await this.ctx.storage.put('text', this.text)
    }
  }

  private async finish(status: 'done' | 'error', errorMsg = '') {
    this.status = status
    this.errorMsg = errorMsg
    await this.ctx.storage.put('text', this.text)
    await this.ctx.storage.put('meta', this.meta())
    this.notify(status === 'done' ? { t: 'done' } : { t: 'err', m: errorMsg })
    this.listeners.clear()
  }

  /**
   * Silent retry wrapper: free/small models fail or return empty responses
   * often enough that one attempt isn't reliable. Attached clients only ever
   * see an error if every attempt fails; a retry after partial output emits
   * a 'reset' so clients discard what they received and re-stream cleanly.
   */
  private async run(model: string, messages: { role: string; content: string }[]) {
    console.log(`[job] run() starting, model=${model}`)
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        if (this.text) {
          this.text = ''
          this.lastPersisted = 0
          await this.ctx.storage.put('text', '')
          this.notify({ t: 'reset' })
        }
        // After a failed attempt, tell the model to stop ruminating; an
        // identical retry tends to reproduce the identical death spiral.
        const attemptMessages =
          attempt === 1 ? messages : [...messages, { role: 'user', content: NO_OVERTHINK_PROMPT }]
        let finish = await this.attempt(model, attemptMessages)
        // The model must close with the END marker. A stream that stopped for
        // length (or just went quiet mid-file) gets continuation turns that
        // pick up exactly where it left off, appending to the same text.
        for (
          let cont = 0;
          !END_RE.test(this.text) && this.text.trim().length >= 200 && cont < MAX_CONTINUATIONS;
          cont++
        ) {
          console.log(`[job] incomplete (finish=${finish}), continuation ${cont + 1}`)
          finish = await this.attempt(model, [
            ...attemptMessages,
            { role: 'assistant', content: this.text },
            { role: 'user', content: CONTINUE_PROMPT },
          ])
        }
        // Tiny responses are refusals or rate-limit apologies; responses
        // without the protocol markers never contained a program. Retry
        // rather than surface them.
        if (this.text.trim().length < 200 || !END_RE.test(this.text) || !SECTION_RE.test(this.text)) {
          throw new Error('The model returned an incomplete or unusable response.')
        }
        console.log(`[job] done, ${this.text.length} chars (attempt ${attempt})`)
        await this.finish('done')
        return
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.log(`[job] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${msg}`)
        if (attempt === MAX_ATTEMPTS) {
          await this.finish('error', msg)
          return
        }
        await new Promise((r) => setTimeout(r, 1500 * attempt))
      }
    }
  }

  /** One upstream completion; returns the stream's finish_reason (if any). */
  private async attempt(
    model: string,
    messages: { role: string; content: string }[]
  ): Promise<string | null> {
    let finishReason: string | null = null
    {
      const apiKey = this.env.OPENROUTER_API_KEY
      if (!apiKey) throw new Error('Server is missing OPENROUTER_API_KEY.')
      const upstream = await fetch(`${OPENROUTER}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://vibe95.app',
          'X-Title': 'Vibe95',
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          // Experiment: thinking disabled outright. Previously a hard
          // budget (max_tokens: 8000) because the free MiniMax model
          // ignored effort hints and thought 165k chars until it hit its
          // output cap with ZERO content. THINK_CAP_CHARS stays as a
          // backstop for models that ignore this too.
          reasoning: { enabled: false },
        }),
      })
      console.log(`[job] upstream responded: ${upstream.status}`)
      if (!upstream.ok || !upstream.body) {
        const text = await upstream.text()
        let message = `OpenRouter error (${upstream.status})`
        try {
          const parsed = JSON.parse(text) as { error?: { message?: string } }
          message = parsed?.error?.message || message
        } catch {
          /* keep default */
        }
        throw new Error(message)
      }

      const reader = upstream.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let thinkChars = 0
      let thinkNotified = 0
      for (;;) {
        // Watchdog: if the provider goes quiet for 2 minutes, fail the job
        // instead of leaving clients attached to a silent stream forever.
        // The timer MUST be cleared after each read; leaking one per chunk
        // hits workerd's active-timeout cap mid-generation.
        let stallTimer: ReturnType<typeof setTimeout> | undefined
        const result = await Promise.race([
          reader.read(),
          new Promise<'stall'>((r) => {
            stallTimer = setTimeout(() => r('stall'), 120_000)
          }),
        ]).finally(() => clearTimeout(stallTimer))
        if (result === 'stall') {
          await reader.cancel().catch(() => {})
          throw new Error('The model stopped responding. Try again or pick another model.')
        }
        const { done, value } = result
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as {
              error?: { message?: string }
              choices?: { delta?: { content?: string }; finish_reason?: string | null }[]
            }
            if (parsed.error) throw new Error(parsed.error.message || 'Provider error')
            if (parsed.choices?.[0]?.finish_reason) finishReason = parsed.choices[0].finish_reason
            const choice = (parsed.choices?.[0]?.delta ?? {}) as {
              content?: string
              reasoning?: string
            }
            if (choice.reasoning) {
              thinkChars += choice.reasoning.length
              if (thinkChars > THINK_CAP_CHARS && this.text.length === 0) {
                await reader.cancel().catch(() => {})
                throw new Error('The model spent its whole budget thinking. Retrying.')
              }
              if (thinkChars - thinkNotified >= 400) {
                thinkNotified = thinkChars
                this.notify({ t: 'think', n: thinkChars })
              }
            }
            if (choice.content) await this.append(choice.content)
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e
          }
        }
      }
    }
    console.log(`[job] attempt finished, finish_reason=${finishReason}, ${this.text.length} chars`)
    return finishReason
  }

  /** SSE stream of the job from a given offset: snapshot, then live deltas. */
  async fetch(req: Request): Promise<Response> {
    await this.load()
    const from = Math.max(0, Number(new URL(req.url).searchParams.get('from') ?? '0') || 0)
    const encoder = new TextEncoder()
    let listener: ((ev: StreamEvent) => void) | null = null
    const listeners = this.listeners
    const self = this

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (ev: StreamEvent) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
        send({ t: 'snap', text: self.text.slice(from) })
        if (self.status === 'done') {
          send({ t: 'done' })
          controller.close()
          return
        }
        if (self.status === 'error') {
          send({ t: 'err', m: self.errorMsg })
          controller.close()
          return
        }
        listener = (ev) => {
          try {
            send(ev)
            if (ev.t === 'done' || ev.t === 'err') controller.close()
          } catch {
            /* client went away; cancel() handles cleanup */
          }
        }
        listeners.add(listener)
      },
      cancel() {
        if (listener) listeners.delete(listener)
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    })
  }

  async alarm() {
    await this.ctx.storage.deleteAll()
  }
}
