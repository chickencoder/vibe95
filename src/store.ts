import { create } from 'zustand'

/* ===== Window manager ================================================ */

export type AppKind =
  | 'studio'
  | 'exe'
  | 'mycomputer'
  | 'savedialog'
  | 'welcome'
  | 'chat'
  | 'newroom'
  | 'changeicon'
  | 'upload'
  | 'properties'
  | 'folder'

export interface WinState {
  id: string
  kind: AppKind
  title: string
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
  maximized: boolean
  /** app-specific data, e.g. { fileName } for exe windows */
  payload?: Record<string, unknown>
}

interface WindowsStore {
  windows: WinState[]
  nextZ: number
  open: (kind: AppKind, opts?: Partial<Omit<WinState, 'id' | 'kind' | 'z'>>) => string
  close: (id: string) => void
  focus: (id: string) => void
  setTitle: (id: string, title: string) => void
  updatePayload: (id: string, payload: Record<string, unknown>) => void
  move: (id: string, x: number, y: number) => void
  resize: (id: string, w: number, h: number) => void
  toggleMinimize: (id: string) => void
  toggleMaximize: (id: string) => void
  topId: () => string | null
}

/** Window chrome around the client area: 3px frame each side; top adds the
 * titlebar (20px incl. padding) and the 2px body margin. */
const CHROME_W = 6
const CHROME_H = 28

/** Outer window size for a program's designed client area, kept on screen. */
export function exeWindowSize(client: { w: number; h: number }): { w: number; h: number } {
  return {
    w: Math.min(client.w + CHROME_W, window.innerWidth - 16),
    h: Math.min(client.h + CHROME_H, window.innerHeight - 28 - 16),
  }
}

let seq = 0
const DEFAULTS: Record<AppKind, { title: string; w: number; h: number }> = {
  studio: { title: 'Vibe Studio', w: 900, h: 560 },
  exe: { title: 'Program', w: 560, h: 440 },
  mycomputer: { title: 'My Computer', w: 420, h: 320 },
  savedialog: { title: 'Save Program As', w: 360, h: 150 },
  welcome: { title: 'Welcome', w: 480, h: 430 },
  chat: { title: 'Vibe Chat', w: 620, h: 440 },
  newroom: { title: 'Create New Room', w: 340, h: 148 },
  changeicon: { title: 'Change Icon', w: 372, h: 322 },
  upload: { title: 'Upload', w: 440, h: 330 },
  properties: { title: 'Properties', w: 320, h: 300 },
  folder: { title: 'Folder', w: 420, h: 320 },
}

/** Fixed-size dialog windows: no resize, no maximize, centered exactly. */
export const DIALOG_KINDS: ReadonlySet<AppKind> = new Set([
  'welcome',
  'savedialog',
  'newroom',
  'changeicon',
  'upload',
  'properties',
])

export const useWindows = create<WindowsStore>((set, get) => ({
  windows: [],
  nextZ: 10,
  open: (kind, opts = {}) => {
    const id = `win-${++seq}`
    const d = DEFAULTS[kind]
    // Everything opens centered on the screen; regular app windows get a
    // small cascade offset so stacked windows stay distinguishable. Dialogs
    // center exactly.
    const w = opts.w ?? d.w
    const h = opts.h ?? d.h
    const dialog = DIALOG_KINDS.has(kind)
    const cascade = dialog ? 0 : (get().windows.length % 5) * 24
    const cx = Math.round((window.innerWidth - w) / 2) + cascade
    const cy = Math.round((window.innerHeight - 28 - h) / 2) + cascade
    set((s) => ({
      nextZ: s.nextZ + 1,
      windows: [
        ...s.windows,
        {
          id,
          kind,
          title: opts.title ?? d.title,
          x: opts.x ?? Math.max(0, Math.min(cx, window.innerWidth - w - 8)),
          y: opts.y ?? Math.max(0, Math.min(cy, window.innerHeight - 28 - h - 8)),
          w,
          h,
          z: s.nextZ + 1,
          minimized: false,
          maximized: false,
          payload: opts.payload,
        },
      ],
    }))
    return id
  },
  close: (id) => set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })),
  focus: (id) =>
    set((s) => ({
      nextZ: s.nextZ + 1,
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, z: s.nextZ + 1, minimized: false } : w
      ),
    })),
  setTitle: (id, title) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, title } : w)),
    })),
  updatePayload: (id, payload) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, payload: { ...w.payload, ...payload } } : w
      ),
    })),
  move: (id, x, y) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)),
    })),
  resize: (id, w2, h2) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, w: w2, h: h2 } : w)),
    })),
  toggleMinimize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, minimized: !w.minimized } : w
      ),
    })),
  toggleMaximize: (id) =>
    set((s) => {
      const nz = s.nextZ + 1
      return {
        nextZ: nz,
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, maximized: !w.maximized, z: nz } : w
        ),
      }
    }),
  topId: () => {
    const visible = get().windows.filter((w) => !w.minimized)
    if (!visible.length) return null
    return visible.reduce((a, b) => (a.z > b.z ? a : b)).id
  },
}))

/* ===== Virtual filesystem (saved .EXE programs) ====================== */

export interface ExeFile {
  name: string // e.g. "DOOM.EXE"
  /** The assembled, runnable single-file artifact. */
  html: string
  createdAt: number
  /** 16x16 model-drawn icon: 256 chars of VGA hex digits or '.' */
  icon?: string | null
  /** Source files (path -> content) for multi-file programs; the .EXE is
   * really a folder of these, assembled into html for running/sharing. */
  files?: Record<string, string> | null
  /** Desktop folder this program lives in (null/undefined = the desktop). */
  folder?: string | null
}

export const FOLDER_NAME_RE = /^[A-Za-z0-9_\-][A-Za-z0-9 _\-]{0,19}$/

interface FsStore {
  files: Record<string, ExeFile>
  folders: string[]
  loaded: boolean
  loadFromServer: () => Promise<void>
  saveFile: (
    name: string,
    html: string,
    icon?: string | null,
    sourceFiles?: Record<string, string> | null
  ) => string
  /** Add a file the server already stored (e.g. a Vibe Chat download). */
  addLocal: (file: ExeFile) => void
  /** Repaint an existing program with a library icon. */
  setIcon: (name: string, icon: string) => void
  /** Rename a program; returns an error message or null on success. */
  renameFile: (from: string, to: string) => Promise<string | null>
  /** Move a program into a folder (null = back to the desktop). */
  moveFile: (name: string, folder: string | null) => void
  /** Create a folder; returns an error message or null on success. */
  createFolder: (name: string) => Promise<string | null>
  /** Rename a folder; returns an error message or null on success. */
  renameFolder: (from: string, to: string) => Promise<string | null>
  /** Delete a folder; its contents go back to the desktop. */
  deleteFolder: (name: string) => void
  deleteFile: (name: string) => void
  clearLocal: () => void
}

export function normalizeExeName(raw: string): string {
  let name = raw
    .trim()
    .toUpperCase()
    .replace(/\.EXE$/i, '')
    .replace(/[^A-Z0-9_\-]/g, '_')
    .slice(0, 16)
  if (!name) name = 'PROGRAM'
  return `${name}.EXE`
}

export const useFs = create<FsStore>((set) => ({
  files: {},
  folders: [],
  loaded: false,
  loadFromServer: async () => {
    const res = await fetch('/api/programs')
    if (!res.ok) return
    const body = (await res.json()) as { programs: ExeFile[]; folders?: string[] }
    const files: Record<string, ExeFile> = {}
    for (const p of body.programs) files[p.name] = p
    set({ files, folders: body.folders ?? [], loaded: true })
  },
  addLocal: (file) =>
    set((s) => ({ files: { ...s.files, [file.name]: file } })),
  saveFile: (name, html, icon, sourceFiles) => {
    const final = normalizeExeName(name)
    set((s) => ({
      files: {
        ...s.files,
        [final]: {
          name: final,
          html,
          createdAt: Date.now(),
          // An omitted icon keeps whatever this file already had.
          icon: icon ?? s.files[final]?.icon ?? null,
          files: sourceFiles ?? s.files[final]?.files ?? null,
        },
      },
    }))
    // Fire-and-forget cloud save; the optimistic local copy is the UI source.
    fetch(`/api/programs/${encodeURIComponent(final)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, icon: icon ?? undefined, files: sourceFiles ?? undefined }),
    }).catch(() => {})
    return final
  },
  setIcon: (name, icon) => {
    const existing = useFs.getState().files[name]
    if (!existing) return
    set((s) => ({ files: { ...s.files, [name]: { ...s.files[name], icon } } }))
    // The PUT upsert overwrites html and files unconditionally, so resend
    // the current ones alongside the new icon.
    fetch(`/api/programs/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html: existing.html,
        icon,
        files: existing.files ?? undefined,
      }),
    }).catch(() => {})
  },
  renameFile: async (from, to) => {
    const final = normalizeExeName(to)
    const s = useFs.getState()
    if (!s.files[from]) return 'No such program.'
    if (final !== from && s.files[final]) return 'A program with that name already exists.'
    if (final !== from) {
      set((st) => {
        const files = { ...st.files }
        files[final] = { ...files[from], name: final }
        delete files[from]
        return { files }
      })
      const res = await fetch(`/api/programs/${encodeURIComponent(from)}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: final }),
      }).catch(() => null)
      if (!res?.ok) {
        // Roll the optimistic rename back so the desktop matches the server.
        set((st) => {
          const files = { ...st.files }
          files[from] = { ...files[final], name: from }
          delete files[final]
          return { files }
        })
        return 'The program could not be renamed.'
      }
    }
    return null
  },
  moveFile: (name, folder) => {
    set((s) => {
      if (!s.files[name]) return s
      return { files: { ...s.files, [name]: { ...s.files[name], folder } } }
    })
    fetch(`/api/programs/${encodeURIComponent(name)}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder }),
    }).catch(() => {})
  },
  createFolder: async (name) => {
    const trimmed = name.trim()
    if (!FOLDER_NAME_RE.test(trimmed)) return 'Folder names can use letters, numbers, spaces, - and _.'
    const s = useFs.getState()
    if (s.folders.includes(trimmed)) return 'A folder with that name already exists.'
    set((st) => ({ folders: [...st.folders, trimmed] }))
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    }).catch(() => null)
    if (!res?.ok) {
      set((st) => ({ folders: st.folders.filter((f) => f !== trimmed) }))
      return 'The folder could not be created.'
    }
    return null
  },
  renameFolder: async (from, to) => {
    const trimmed = to.trim()
    if (!FOLDER_NAME_RE.test(trimmed)) return 'Folder names can use letters, numbers, spaces, - and _.'
    const s = useFs.getState()
    if (trimmed === from) return null
    if (s.folders.includes(trimmed)) return 'A folder with that name already exists.'
    set((st) => ({
      folders: st.folders.map((f) => (f === from ? trimmed : f)),
      files: Object.fromEntries(
        Object.entries(st.files).map(([k, v]) => [
          k,
          v.folder === from ? { ...v, folder: trimmed } : v,
        ])
      ),
    }))
    const res = await fetch(`/api/folders/${encodeURIComponent(from)}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: trimmed }),
    }).catch(() => null)
    if (!res?.ok) {
      set((st) => ({
        folders: st.folders.map((f) => (f === trimmed ? from : f)),
        files: Object.fromEntries(
          Object.entries(st.files).map(([k, v]) => [
            k,
            v.folder === trimmed ? { ...v, folder: from } : v,
          ])
        ),
      }))
      return 'The folder could not be renamed.'
    }
    return null
  },
  deleteFolder: (name) => {
    set((s) => ({
      folders: s.folders.filter((f) => f !== name),
      files: Object.fromEntries(
        Object.entries(s.files).map(([k, v]) => [
          k,
          v.folder === name ? { ...v, folder: null } : v,
        ])
      ),
    }))
    fetch(`/api/folders/${encodeURIComponent(name)}`, { method: 'DELETE' }).catch(() => {})
  },
  deleteFile: (name) => {
    set((s) => {
      const files = { ...s.files }
      delete files[name]
      return { files }
    })
    fetch(`/api/programs/${encodeURIComponent(name)}`, { method: 'DELETE' }).catch(() => {})
  },
  clearLocal: () => set({ files: {}, folders: [], loaded: false }),
}))

/* ===== Landing page idea ============================================= */

const PENDING_PROMPT_KEY = 'vibe95-pending-prompt'

/** An idea typed into the landing page demo, waiting for the next logon. */
export function pendingPrompt(): string {
  try {
    return localStorage.getItem(PENDING_PROMPT_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Store the idea, or drop it with null. Blocked storage just loses it. */
export function setPendingPrompt(text: string | null) {
  try {
    if (text) localStorage.setItem(PENDING_PROMPT_KEY, text)
    else localStorage.removeItem(PENDING_PROMPT_KEY)
  } catch {
    /* storage blocked: they retype it in the studio */
  }
}
