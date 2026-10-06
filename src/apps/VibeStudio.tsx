import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import {
  ChatMessage,
  SYSTEM_PROMPT,
  startGeneration,
  streamJob,
} from '../api'
import {
  applyResponse,
  assembleProgram,
  extractSize,
  missingReferences,
  parseProtocol,
  protocolText,
  renderProtocol,
  strayProse,
  type ProgramSize,
} from '../protocol'
import { checkProgramFiles, verifyProgram } from '../verify'
import { FolderIcon } from '../icons'
import { iconForName } from '../iconLibrary'
import { exeWindowSize, normalizeExeName, useFs, useWindows } from '../store'

const MODEL = 'minimax/minimax-m3:free'
const MAX_REPAIRS = 3
const SESSION_KEY = 'vibe95-studio'

interface LogEntry {
  who: 'user' | 'assistant' | 'error' | 'system'
  text: string
}

/** Where the current generation is, for the step-list progress panel. */
interface GenProgress {
  phase: 'contacting' | 'thinking' | 'writing' | 'testing'
  thinkChars: number
  codeChars: number
  attempt: number
  /** File currently being written, when known. */
  file?: string | null
}

interface ActiveJob {
  id: string
  convo: ChatMessage[]
  userText: string
  repairs: number
  /** The user's original request for this generate; repairs keep this. */
  originPrompt: string
  /** Studio history when generate() was clicked. */
  originConvo: ChatMessage[]
}

interface StudioSession {
  history: ChatMessage[]
  log: LogEntry[]
  code: string
  /** Source files of the current program (path -> content). */
  programFiles: Record<string, string>
  programName: string | null
  programIcon?: string | null
  programSize?: ProgramSize | null
  activeJob: ActiveJob | null
}

function loadSession(): StudioSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as StudioSession & { programHtml?: string }
    // Sessions saved before multi-file programs carried one html string.
    if (!s.programFiles) {
      s.programFiles = s.programHtml ? { 'index.html': s.programHtml } : {}
    }
    return s
  } catch {
    return null
  }
}

/** Seed a session from an existing .EXE so the user can iterate on it. */
function editSession(fileName: string): StudioSession | null {
  const file = useFs.getState().files[fileName]
  if (!file) return null
  const programFiles = file.files ?? { 'index.html': file.html }
  const size = extractSize(file.html)
  // The assistant history shows the program in protocol form so the model
  // has a canonical example of the format it must answer in.
  const rendered = renderProtocol(programFiles, {
    name: fileName.replace(/\.EXE$/, ''),
    size,
  })
  return {
    history: [
      {
        role: 'user',
        content: `I want to edit my existing program ${fileName}. Show me its current files.`,
      },
      { role: 'assistant', content: rendered },
    ],
    log: [
      { who: 'system', text: `Opened ${fileName} for editing. Describe the changes you want.` },
    ],
    code: rendered,
    programFiles,
    programName: fileName,
    programIcon: file.icon ?? null,
    programSize: size,
    activeJob: null,
  }
}

const STEPS = ['contacting', 'thinking', 'writing', 'testing'] as const

/** How a file's shown contents were produced. */
type FileKind = 'file' | 'edit'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function grammarFor(path: string): { grammar: Prism.Grammar; lang: string } | null {
  if (/\.css$/i.test(path)) return { grammar: Prism.languages.css, lang: 'css' }
  if (/\.(js|json)$/i.test(path)) return { grammar: Prism.languages.javascript, lang: 'javascript' }
  if (/\.(html|svg)$/i.test(path)) return { grammar: Prism.languages.markup, lang: 'markup' }
  return null
}

/** SEARCH/REPLACE fence rows inside an in-flight EDIT section. */
const EDIT_MARKER_RE = /^(?:<{4,9}[ \t]*SEARCH|={4,9}|>{4,9}[ \t]*REPLACE)[ \t]*$/

/**
 * Highlight one file's contents in its own language. An in-flight EDIT
 * section is not a whole file, so its fence rows are marked and the code
 * between them is highlighted normally.
 */
function highlightFile(path: string, content: string, kind: FileKind): string {
  const g = grammarFor(path)
  const paint = (text: string) =>
    g ? Prism.highlight(text, g.grammar, g.lang) : escapeHtml(text)
  if (kind !== 'edit') return paint(content)
  const out: string[] = []
  let chunk: string[] = []
  const flush = () => {
    if (!chunk.length) return
    out.push(paint(chunk.join('\n')))
    chunk = []
  }
  for (const line of content.split('\n')) {
    if (EDIT_MARKER_RE.test(line)) {
      flush()
      out.push(`<span class="proto-marker">${escapeHtml(line)}</span>`)
      continue
    }
    chunk.push(line)
  }
  flush()
  return out.join('\n')
}

/** A tiny Win95-explorer document icon, tinted by file type. */
function FileGlyph({ path }: { path: string }) {
  const fill = /\.css$/i.test(path)
    ? '#800080'
    : /\.(js|json)$/i.test(path)
      ? '#808000'
      : '#000080'
  return (
    <svg className="tree-glyph" width={13} height={13} viewBox="0 0 13 13">
      <path d="M2 0h6l3 3v10H2z" fill="#fff" stroke="#000" strokeWidth={1} shapeRendering="crispEdges" />
      <path d="M8 0l3 3H8z" fill="#c0c0c0" stroke="#000" strokeWidth={1} shapeRendering="crispEdges" />
      <rect x={4} y={6} width={5} height={1} fill={fill} />
      <rect x={4} y={8} width={5} height={1} fill={fill} />
      <rect x={4} y={10} width={3} height={1} fill={fill} />
    </svg>
  )
}

export function StepRow({
  state,
  children,
  detail,
  note,
}: {
  state: 'done' | 'active' | 'pending'
  children: ReactNode
  /** live counter line under the label; only shown while active */
  detail?: string
  note?: string
}) {
  return (
    <div className={`gen-step ${state}`}>
      <span className="gen-step-glyph">
        {state === 'done' ? '✓' : state === 'active' ? '►' : '·'}
      </span>
      <span className="gen-step-body">
        <span className={state === 'active' ? 'busy-dots' : undefined}>{children}</span>
        {detail && state === 'active' && <span className="gen-step-detail">{detail}</span>}
        {note && state === 'active' && <span className="gen-step-note">{note}</span>}
      </span>
    </div>
  )
}

function ProgressPanel({ prog }: { prog: GenProgress }) {
  const at = STEPS.indexOf(prog.phase)
  const stateOf = (step: (typeof STEPS)[number]) => {
    const i = STEPS.indexOf(step)
    return i < at ? 'done' : i === at ? 'active' : 'pending'
  }
  return (
    <div className="gen-progress">
      <div className="gen-progress-title">
        {prog.attempt > 0
          ? `Fixing problems (attempt ${prog.attempt} of ${MAX_REPAIRS})`
          : 'Building your program'}
      </div>
      <StepRow state={stateOf('contacting')}>Contacting the AI</StepRow>
      <StepRow
        state={stateOf('thinking')}
        detail={
          prog.thinkChars > 0
            ? `${prog.thinkChars.toLocaleString()} characters of thought`
            : undefined
        }
        note="The AI plans the whole program before writing a single line."
      >
        Thinking it through
      </StepRow>
      <StepRow
        state={stateOf('writing')}
        detail={
          prog.codeChars > 0
            ? `${prog.file ? `${prog.file}, ` : ''}${prog.codeChars.toLocaleString()} characters written`
            : undefined
        }
      >
        Writing the code
      </StepRow>
      <StepRow state={stateOf('testing')}>Testing the program</StepRow>
      <div className="gen-progress-foot">
        <span>
          Your program keeps building on the server even if you close this window or
          refresh the page.
        </span>
      </div>
    </div>
  )
}

export function VibeStudio({ winId, editFile }: { winId: string; editFile?: string }) {
  const { open, setTitle, updatePayload } = useWindows()
  const saveFile = useFs((s) => s.saveFile)
  const saved = useRef(editFile ? editSession(editFile) : loadSession()).current
  // An idea typed into the landing page demo before logging on.
  const [prompt, setPrompt] = useState(() =>
    editFile ? '' : (localStorage.getItem('vibe95-pending-prompt') ?? '')
  )
  const [log, setLog] = useState<LogEntry[]>(saved?.log ?? [])
  const [history, setHistory] = useState<ChatMessage[]>(saved?.history ?? [])
  const [code, setCode] = useState(saved?.code ?? '')
  const [programFiles, setProgramFiles] = useState<Record<string, string>>(
    saved?.programFiles ?? {}
  )
  const [programName, setProgramName] = useState<string | null>(saved?.programName ?? null)
  const [programIcon, setProgramIcon] = useState<string | null>(saved?.programIcon ?? null)
  const [programSize, setProgramSize] = useState<ProgramSize | null>(saved?.programSize ?? null)
  const sizeRef = useRef<ProgramSize | null>(saved?.programSize ?? null)
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(saved?.activeJob ?? null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Ready')
  const [prog, setProg] = useState<GenProgress | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const codeRef = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const playWinRef = useRef<string | null>(null)
  const resumedRef = useRef(false)
  // Mirror of programFiles for the repair chain: finishTurn -> beginTurn ->
  // finishTurn runs inside one async flow where state reads would be stale.
  const filesRef = useRef<Record<string, string>>(saved?.programFiles ?? {})
  // NAME arrives on the first build response, but repair responses carry
  // only NOTE+EDIT sections — capture it across the whole repair chain
  // (a ref, for the same staleness reason as filesRef).
  const pendingNameRef = useRef<string | null>(null)

  /** The assembled single-file artifact: what runs, saves, and shares. */
  const programHtml = useMemo(
    () => (Object.keys(programFiles).length ? assembleProgram(programFiles, programSize) : ''),
    [programFiles, programSize]
  )

  function setFiles(files: Record<string, string>) {
    filesRef.current = files
    setProgramFiles(files)
  }

  // Persist the whole studio session so a refresh loses nothing. Edit-mode
  // windows are seeded from the .EXE and never resumed (see the effect
  // below), so they must NOT write here — that would clobber the main
  // session, including a resumable in-flight activeJob.
  useEffect(() => {
    if (editFile) return
    const session: StudioSession = {
      history,
      log,
      code,
      programFiles,
      programName,
      programIcon,
      programSize,
      activeJob,
    }
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {
      /* quota, drop silently */
    }
  }, [history, log, code, programFiles, programName, programIcon, programSize, activeJob])

  useEffect(() => () => abortRef.current?.abort(), [])

  // The landing page idea is consumed once it is in the prompt box.
  useEffect(() => {
    if (!editFile) localStorage.removeItem('vibe95-pending-prompt')
  }, [])

  // Re-attach to a generation that was running when the page was refreshed.
  // Delayed and cancelable so StrictMode's mount/unmount/mount cycle doesn't
  // abort the resumed stream.
  useEffect(() => {
    if (!saved?.activeJob || resumedRef.current || editFile) return
    const job = saved.activeJob
    const t = setTimeout(() => {
      resumedRef.current = true
      appendLog({ who: 'system', text: 'Reconnected to the running generation.' })
      void runJob(job)
    }, 150)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log, busy])

  // The files the model is writing right now, parsed out of the live stream.
  // parseProtocol tolerates a half-written section, so a file appears in the
  // explorer as soon as its === FILE: === marker arrives.
  const liveFiles = useMemo(() => {
    if (!busy || !code) return null
    const parsed = parseProtocol(code)
    if (!parsed.sections.length) return null
    const map: Record<string, { content: string; kind: FileKind }> = {}
    for (const sec of parsed.sections) {
      if (sec.kind === 'delete') continue
      map[sec.path] = { content: sec.body, kind: sec.kind === 'edit' ? 'edit' : 'file' }
    }
    return map
  }, [busy, code])

  // What the explorer lists: the program's saved files, overlaid with
  // whatever this turn is writing (an edit turn only touches some of them).
  const view = useMemo(() => {
    const out: Record<string, { content: string; kind: FileKind }> = {}
    for (const [path, content] of Object.entries(programFiles)) {
      out[path] = { content, kind: 'file' }
    }
    if (liveFiles) Object.assign(out, liveFiles)
    return out
  }, [programFiles, liveFiles])

  const paths = useMemo(() => {
    // index.html first, then the rest alphabetically: the VB project pane order.
    return Object.keys(view).sort((a, b) =>
      a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)
    )
  }, [view])

  const active = selected && view[selected] ? selected : (paths[0] ?? null)
  const activeFile = active ? view[active] : null

  // Follow the file being written, while leaving the user free to click
  // another one until the model moves on to the next file.
  useEffect(() => {
    if (busy && prog?.file) setSelected(prog.file)
  }, [busy, prog?.file])

  const highlighted = useMemo(
    () => (activeFile && active ? highlightFile(active, activeFile.content, activeFile.kind) : ''),
    [active, activeFile]
  )

  // Switching files starts at the top; a streaming file follows the writing.
  useEffect(() => {
    if (codeRef.current) codeRef.current.scrollTop = 0
  }, [active])

  useEffect(() => {
    if (busy && codeRef.current) codeRef.current.scrollTop = codeRef.current.scrollHeight
  }, [highlighted, busy])

  function appendLog(entry: LogEntry) {
    setLog((l) => [...l, entry])
  }

  function play(html?: string, name?: string | null) {
    const content = html ?? programHtml
    if (!content) return
    const title = name ?? programName ?? 'Untitled Program'
    const winSize = sizeRef.current ? exeWindowSize(sizeRef.current) : null
    const existing = playWinRef.current
      ? useWindows.getState().windows.find((w) => w.id === playWinRef.current)
      : null
    if (existing) {
      updatePayload(existing.id, { html: content })
      setTitle(existing.id, title)
      if (winSize) useWindows.getState().resize(existing.id, winSize.w, winSize.h)
      useWindows.getState().focus(existing.id)
    } else {
      playWinRef.current = open('exe', {
        title,
        payload: { html: content },
        ...(winSize ?? {}),
      })
    }
  }

  function snapshotProtocol(files: Record<string, string>, note?: string | null) {
    return renderProtocol(files, {
      name: pendingNameRef.current,
      size: sizeRef.current,
      note: note || undefined,
    })
  }

  /** Repair context: original request + current files, not a stack of failed EDITs. */
  function repairConvo(job: ActiveJob, files: Record<string, string>, note?: string | null): ChatMessage[] {
    const originPrompt = job.originPrompt ?? job.userText
    const originConvo = job.originConvo ?? job.convo
    const msgs: ChatMessage[] = [...originConvo, { role: 'user', content: originPrompt }]
    if (Object.keys(files).length) {
      msgs.push({ role: 'assistant', content: snapshotProtocol(files, note) })
    }
    return msgs
  }

  function repairPrompt(issues: string[]): string {
    const listed = issues.join('\n- ')
    const mustCreate = issues.some(
      (i) =>
        /characters \(limit /i.test(i) ||
        /FILE section for .+ was empty/i.test(i) ||
        /There is no index\.html/i.test(i) ||
        /but no such file was provided/i.test(i)
    )
    if (mustCreate) {
      return (
        `When the program was run, these problems were detected:\n- ${listed}\n\n` +
        `The assistant message above is the current files. Fix only what is broken: ` +
        `add or split files with FILE sections, leave working files alone (do not resend them). ` +
        `Small patches in existing files should be EDIT/SEARCH-REPLACE copied from the current file. ` +
        `End with === END ===`
      )
    }
    return (
      `When the program was run, these problems were detected:\n- ${listed}\n\n` +
      `Make a surgical fix. Use EDIT sections with SEARCH/REPLACE against the current files in the assistant message — ` +
      `copy the SEARCH text from those files (or from the snippet above), including surrounding lines so it is unique. ` +
      `Do not resend unchanged files. Do not rewrite a whole file unless a SEARCH cannot express the change ` +
      `(then FILE that one file only). End with === END ===`
    )
  }

  /** Start a generation turn (fresh prompt or automatic repair). */
  async function beginTurn(
    userText: string,
    convo: ChatMessage[],
    repairs: number,
    origin?: { prompt: string; convo: ChatMessage[] }
  ) {
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...convo,
      { role: 'user', content: userText },
    ]
    const jobId = await startGeneration(MODEL, messages)
    const job: ActiveJob = {
      id: jobId,
      convo,
      userText,
      repairs,
      originPrompt: origin?.prompt ?? userText,
      originConvo: origin?.convo ?? convo,
    }
    setActiveJob(job)
    await runJob(job)
  }

  /** Attach to a job's stream, then verify, repair, or finish. */
  async function runJob(job: ActiveJob) {
    setBusy(true)
    setStatus(job.repairs > 0 ? `Fixing (attempt ${job.repairs})` : 'Generating')
    setProg({ phase: 'contacting', thinkChars: 0, codeChars: 0, attempt: job.repairs })
    abortRef.current = new AbortController()
    try {
      const full = await streamJob(
        job.id,
        (acc) => {
          // Only the protocol portion reaches the code view: anything the
          // model says around it (chatter, apologies) is not code.
          const proto = protocolText(acc)
          setCode(proto)
          // This callback also fires for think-only chunks (and chatter-only
          // text); don't let those stomp the Thinking status.
          if (proto.length > 0) {
            // Surface which file is being written right now.
            let file: string | null = null
            for (const m of acc.matchAll(/^[ \t]*={2,5}\s*(?:FILE|EDIT)\s*:\s*([^\s=]+)/gm)) {
              file = m[1]
            }
            setProg((p) => p && { ...p, phase: 'writing', codeChars: proto.length, file })
            setStatus(
              `${job.repairs > 0 ? 'Fixing' : 'Generating'}: ${proto.length.toLocaleString()} chars`
            )
          }
        },
        abortRef.current.signal,
        (n) => {
          // A 'reset' retry can restart thinking after text already streamed;
          // showing thinking again is more honest than a stuck writing step.
          setProg((p) => p && { ...p, phase: p.phase === 'writing' ? p.phase : 'thinking', thinkChars: n })
          setStatus(`Thinking: ${n.toLocaleString()} chars of reasoning`)
        }
      )
      await finishTurn(full, job)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'Stopped.') {
        appendLog({ who: 'system', text: 'Generation stopped.' })
        setStatus('Stopped')
      } else {
        appendLog({ who: 'error', text: msg })
        setStatus('Error')
      }
      setActiveJob(null)
      setBusy(false)
      setProg(null)
    }
  }

  async function finishTurn(full: string, job: ActiveJob) {
    const originPrompt = job.originPrompt ?? job.userText
    const originConvo = job.originConvo ?? job.convo
    const origin = { prompt: originPrompt, convo: originConvo }
    const parsed = parseProtocol(full)

    if (!parsed.sections.length) {
      // Show what the model actually said instead of leaving the chat blank.
      const said = strayProse(full)
      if (said) appendLog({ who: 'assistant', text: said.slice(0, 400) })
      if (job.repairs < MAX_REPAIRS) {
        appendLog({ who: 'system', text: 'No program in the response. Asking for a rewrite...' })
        await beginTurn(
          'Your previous response contained no FILE or EDIT sections. Follow the response format exactly: === FILE: name === sections with complete file contents, ending with === END ===',
          repairConvo(job, filesRef.current),
          job.repairs + 1,
          origin
        )
        return
      }
      throw new Error('The model did not return a program. Try again.')
    }

    // Apply the response to the current files; edit failures (bad SEARCH
    // text, edits to missing files) are model-fixable and go into QA issues.
    const applied = applyResponse(filesRef.current, parsed)
    if (parsed.size) {
      sizeRef.current = parsed.size
      setProgramSize(parsed.size)
    }
    // Capture the name BEFORE any repair turn: the repair response won't
    // repeat it, and losing it here saved programs as PROGRAM.EXE
    // whenever QA triggered a single repair. (Icons are no longer taken
    // from the model; they come from the built-in set below.)
    if (parsed.name && !pendingNameRef.current) pendingNameRef.current = parsed.name
    const html = assembleProgram(applied.files, sizeRef.current)
    setFiles(applied.files)
    if (job.repairs === 0) {
      // NOTE is the intended channel; fall back to any prose the model wrote
      // around the protocol before giving up and saying something generic.
      const note = parsed.note ?? strayProse(full).split('\n')[0]?.slice(0, 300)
      appendLog({ who: 'assistant', text: note || 'Program updated.' })
    }

    // Lightweight QA: apply/reference problems, per-file syntax with line
    // numbers, then a real render in a hidden sandbox.
    setStatus('Testing program')
    setProg((p) => p && { ...p, phase: 'testing' })
    const fileIssues = checkProgramFiles(applied.files)
    const syntaxBroken = fileIssues.some((i) => /syntax error/i.test(i))
    const issues = [
      ...applied.issues,
      ...missingReferences(applied.files).map(
        (path) => `index.html references ${path}, but no such file was provided. Add a FILE section for it or remove the reference.`
      ),
      ...(applied.files['index.html'] ? [] : ['There is no index.html. Every program needs one.']),
      ...fileIssues,
      ...(await verifyProgram(html, { skipRuntime: syntaxBroken })),
    ]
    if (issues.length && job.repairs < MAX_REPAIRS) {
      appendLog({
        who: 'system',
        text: `Testing found ${issues.length} problem(s). Fixing automatically...`,
      })
      await beginTurn(
        repairPrompt(issues),
        repairConvo(job, applied.files, parsed.note),
        job.repairs + 1,
        origin
      )
      return
    }
    if (issues.length) {
      appendLog({
        who: 'system',
        text: `Warning: ${issues.length} problem(s) remain after ${MAX_REPAIRS} fix attempts.`,
      })
    }

    // Auto-save: a new program gets the model's NAME (deduped against
    // existing files); an edited program keeps its name and is overwritten.
    let finalName = programName
    if (!finalName) {
      const base = normalizeExeName(pendingNameRef.current ?? 'PROGRAM')
      const stem = base.replace(/\.EXE$/, '')
      const files = useFs.getState().files
      finalName = base
      for (let i = 2; files[finalName] && i < 100; i++) {
        finalName = `${stem.slice(0, 16 - String(i).length)}${i}.EXE`
      }
      setProgramName(finalName)
      appendLog({ who: 'system', text: `Saved as ${finalName} on the desktop.` })
    }
    // Icons come from the built-in Win95 set, not the model: a new program
    // gets a deterministic pick, and the user changes it via right-click.
    const icon = programIcon ?? iconForName(finalName)
    if (!programIcon) setProgramIcon(icon)
    saveFile(finalName, html, icon, applied.files)
    setTitle(winId, `Vibe Studio - ${finalName}`)

    // Persist a clean snapshot for the next edit, not the raw EDIT/repair chain.
    setHistory([
      ...originConvo,
      { role: 'user', content: originPrompt },
      { role: 'assistant', content: snapshotProtocol(applied.files, parsed.note) },
    ])
    setActiveJob(null)
    setBusy(false)
    setProg(null)
    setStatus('Done')
    play(html, finalName)
  }

  async function generate() {
    const text = prompt.trim()
    if (!text || busy) return
    setPrompt('')
    appendLog({ who: 'user', text })
    try {
      await beginTurn(text, history, 0)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      appendLog({ who: 'error', text: msg })
      setStatus('Error')
      setActiveJob(null)
      setBusy(false)
      setProg(null)
    }
  }

  function saveAs() {
    if (!programHtml) return
    open('savedialog', {
      payload: {
        html: programHtml,
        files: programFiles,
        icon: programIcon,
        studioWinId: winId,
        suggestedName: programName ?? 'MYAPP',
        onSaved: (finalName: string) => setProgramName(finalName),
      },
      w: 360,
      h: 150,
    })
  }

  function newProgram() {
    setHistory([])
    setLog([])
    setCode('')
    setFiles({})
    setProgramName(null)
    setProgramIcon(null)
    setProgramSize(null)
    sizeRef.current = null
    pendingNameRef.current = null
    setActiveJob(null)
    setSelected(null)
    playWinRef.current = null
    setStatus('Ready')
    setTitle(winId, 'Vibe Studio')
  }

  return (
    <div className={`studio${busy ? ' busy' : ''}`}>
      <div className="studio-toolbar">
        <button className="btn" style={{ minWidth: 50 }} onClick={newProgram} disabled={busy}>
          New
        </button>
        <button
          className="btn"
          style={{ minWidth: 70 }}
          onClick={saveAs}
          disabled={!programHtml || busy}
        >
          Save As...
        </button>
        <button
          className="btn"
          style={{ minWidth: 64, fontWeight: 700 }}
          onClick={() => play()}
          disabled={!programHtml || busy}
        >
          &#9654; Play
        </button>
      </div>

      <div className="studio-main">
        <div className="studio-chat">
          <div className="chat-log well" ref={logRef}>
            {log.length === 0 && (
              <div className="chat-msg assistant">
                <span className="who">Vibe Studio:</span> Describe the program you want to
                build. It gets written, tested, and launched in its own window. Press Play
                to run it again any time.
              </div>
            )}
            {log.map((entry, i) => (
              <div key={i} className={`chat-msg ${entry.who}`}>
                <span className="who">
                  {entry.who === 'user'
                    ? 'You'
                    : entry.who === 'error'
                      ? 'Error'
                      : 'Vibe Studio'}
                  :
                </span>{' '}
                {entry.text}
              </div>
            ))}
          </div>
          {busy && prog && <ProgressPanel prog={prog} />}
          <div className="chat-input-row">
            <textarea
              className="field"
              placeholder="e.g. a snake game"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  generate()
                }
              }}
              disabled={busy}
            />
            <button
              className="btn"
              style={{ minWidth: 56, height: 'auto' }}
              onClick={busy ? () => abortRef.current?.abort() : generate}
            >
              {busy ? 'Stop' : 'Vibe'}
            </button>
          </div>
        </div>

        <div className="studio-code">
          <div className="pane-caption">
            {active ? (
              <>
                {active}
                {activeFile?.kind === 'edit' && ' - changes'}
              </>
            ) : (
              'No file open'
            )}
          </div>
          {highlighted ? (
            <div
              className="code-view well"
              ref={codeRef}
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          ) : (
            <div className="code-view placeholder well" ref={codeRef}>
              {busy
                ? 'The files will appear here as the AI writes them.'
                : 'Describe a program on the left and its files will appear here.'}
            </div>
          )}
        </div>

        <div className="studio-explorer">
          <div className="pane-caption">Project</div>
          <div className="file-tree well">
            <div className="tree-root">
              <FolderIcon size={13} />
              <span>{programName ?? 'Untitled'}</span>
            </div>
            {paths.length === 0 && <div className="tree-empty">(no files yet)</div>}
            {paths.map((path) => (
              <div
                key={path}
                className={`tree-file${path === active ? ' selected' : ''}`}
                onClick={() => setSelected(path)}
              >
                <FileGlyph path={path} />
                <span>{path}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="statusbar">
        <div className="status-cell" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {busy && <span className="progress-marquee" />}
          <span className={busy ? 'busy-dots' : undefined}>{status}</span>
        </div>
        <div className="status-cell" style={{ flex: 'none', minWidth: 120 }}>
          {programName ?? 'Untitled'}
        </div>
      </div>
    </div>
  )
}
