import { DurableObject } from 'cloudflare:workers'
import type { Env } from './env'

const HISTORY_MAX = 200
const MSG_MAX_CHARS = 500
// Rate limit: a user may send at most RATE_MAX messages per RATE_WINDOW_MS.
const RATE_MAX = 5
const RATE_WINDOW_MS = 10_000

export interface ShareInfo {
  shareId: string
  name: string
}

interface UserRef {
  id: string
  name: string
}

type RoomMessage =
  | { t: 'chat'; id: string; user: UserRef; text: string; ts: number }
  | { t: 'share'; id: string; user: UserRef; share: ShareInfo; ts: number }
  | { t: 'sys'; text: string; ts: number }

type ServerEvent =
  | { t: 'hello'; history: RoomMessage[]; users: UserRef[] }
  | { t: 'users'; users: UserRef[] }
  | RoomMessage

/**
 * The one global chat room ("lobby"). Uses the WebSocket hibernation API so
 * idle connections cost nothing; message history lives in DO storage so late
 * joiners get scrollback.
 */
export class VibeRoom extends DurableObject<Env> {
  private history: RoomMessage[] | null = null
  // Best-effort rate limiting; resets if the DO hibernates, which is fine.
  private rate = new Map<string, number[]>()

  private async loadHistory(): Promise<RoomMessage[]> {
    if (!this.history) {
      this.history = (await this.ctx.storage.get<RoomMessage[]>('history')) ?? []
    }
    return this.history
  }

  private users(except?: WebSocket): UserRef[] {
    const seen = new Map<string, UserRef>()
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue
      const u = ws.deserializeAttachment() as UserRef | null
      if (u) seen.set(u.id, u)
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  private broadcast(ev: ServerEvent) {
    const data = JSON.stringify(ev)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data)
      } catch {
        /* socket on its way out */
      }
    }
  }

  private async record(msg: RoomMessage) {
    const history = await this.loadHistory()
    history.push(msg)
    if (history.length > HISTORY_MAX) history.splice(0, history.length - HISTORY_MAX)
    await this.ctx.storage.put('history', history)
    this.broadcast(msg)
  }

  /** Broadcast a program share (called via RPC from the share route). */
  async postShare(user: UserRef, share: ShareInfo) {
    await this.record({
      t: 'share',
      id: crypto.randomUUID(),
      user,
      share,
      ts: Date.now(),
    })
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }
    const user: UserRef = {
      id: req.headers.get('x-user-id') ?? '',
      name: req.headers.get('x-user-name') ?? 'user',
    }
    if (!user.id) return new Response('unauthorized', { status: 401 })

    const wasHere = this.users().some((u) => u.id === user.id)
    const pair = new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1])
    pair[1].serializeAttachment(user)

    const history = await this.loadHistory()
    pair[1].send(JSON.stringify({ t: 'hello', history, users: this.users() } satisfies ServerEvent))
    if (!wasHere) {
      this.broadcast({ t: 'sys', text: `${user.name} has joined the room`, ts: Date.now() })
    }
    this.broadcast({ t: 'users', users: this.users() })

    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const user = ws.deserializeAttachment() as UserRef | null
    if (!user || typeof raw !== 'string') return
    let text: string
    try {
      const parsed = JSON.parse(raw) as { t?: string; text?: unknown }
      if (parsed.t !== 'chat' || typeof parsed.text !== 'string') return
      text = parsed.text.trim().slice(0, MSG_MAX_CHARS)
    } catch {
      return
    }
    if (!text) return

    const now = Date.now()
    const stamps = (this.rate.get(user.id) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
    if (stamps.length >= RATE_MAX) {
      ws.send(
        JSON.stringify({
          t: 'sys',
          text: 'You are sending messages too quickly. Wait a moment.',
          ts: now,
        } satisfies ServerEvent)
      )
      return
    }
    stamps.push(now)
    this.rate.set(user.id, stamps)

    await this.record({ t: 'chat', id: crypto.randomUUID(), user, text, ts: now })
  }

  async webSocketClose(ws: WebSocket) {
    const user = ws.deserializeAttachment() as UserRef | null
    // Exclude the closing socket explicitly: whether getWebSockets() still
    // lists it during this callback is an implementation detail.
    const remaining = this.users(ws)
    if (user && !remaining.some((u) => u.id === user.id)) {
      this.broadcast({ t: 'sys', text: `${user.name} has left the room`, ts: Date.now() })
    }
    this.broadcast({ t: 'users', users: remaining })
  }
}
