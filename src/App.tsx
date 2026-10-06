import { useEffect, useRef, useState } from 'react'
import { authClient } from './authClient'
import { Logon } from './components/Logon'
import { Landing } from './components/Landing'
import { exeWindowSize, normalizeExeName, useFs, useWindows, DIALOG_KINDS } from './store'
import { extractSize } from './protocol'
import { Window } from './components/Window'
import { Taskbar } from './components/Taskbar'
import { StartMenu } from './components/StartMenu'
import { VibeStudio } from './apps/VibeStudio'
import { ExeRunner } from './apps/ExeRunner'
import { SaveDialog } from './apps/SaveDialog'
import { MyComputer } from './apps/MyComputer'
import { Welcome } from './apps/Welcome'
import { VibeChat } from './apps/VibeChat'
import { NewRoomDialog } from './apps/NewRoomDialog'
import { ChangeIconDialog } from './apps/ChangeIconDialog'
import { UploadDialog } from './apps/UploadDialog'
import { PropertiesDialog } from './apps/PropertiesDialog'
import { FolderView } from './apps/FolderView'
import { ChatIcon, ComputerIcon, FolderIcon, ProgramIcon, StudioIcon } from './icons'

type CtxTarget =
  | { kind: 'file'; name: string }
  | { kind: 'folder'; name: string }
  | { kind: 'desktop' }

interface CtxMenu {
  x: number
  y: number
  target: CtxTarget
}

interface Renaming {
  kind: 'file' | 'folder'
  name: string
  value: string
}

interface Marquee {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Desktop selection ids: builtins ('__studio'), files ('X.EXE'), folders ('dir:NAME'). */
const dirId = (name: string) => `dir:${name}`

/* Icon grid: matches the old flow layout (74x66 icons + gaps). Positions are
 * relative to the .desktop-icons container and snap to cells on drop. */
const GRID_X = 82
const GRID_Y = 72
const POS_KEY = 'vibe95-icon-pos'

interface Pos {
  x: number
  y: number
}

type LogonMode = 'signin' | 'signup'

/** Signed out, the hash picks the screen: #logon, #new-user, or the landing page. */
function logonFromHash(): LogonMode | null {
  if (location.hash === '#logon') return 'signin'
  if (location.hash === '#new-user') return 'signup'
  return null
}

/** Drop #logon / #new-user without adding a history entry. */
function clearHash() {
  history.replaceState(null, '', location.pathname + location.search)
}

function loadPositions(): Record<string, Pos> {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY) ?? '{}') as Record<string, Pos>
  } catch {
    return {}
  }
}

export default function App() {
  const { data: session, isPending, refetch } = authClient.useSession()
  const { windows, open, topId } = useWindows()
  const files = useFs((s) => s.files)
  const folders = useFs((s) => s.folders)
  const deleteFile = useFs((s) => s.deleteFile)
  const deleteFolder = useFs((s) => s.deleteFolder)
  const renameFile = useFs((s) => s.renameFile)
  const renameFolder = useFs((s) => s.renameFolder)
  const moveFile = useFs((s) => s.moveFile)
  const createFolder = useFs((s) => s.createFolder)
  const loadFromServer = useFs((s) => s.loadFromServer)
  const clearLocal = useFs((s) => s.clearLocal)
  const [logon, setLogon] = useState<LogonMode | null>(logonFromHash)
  const [startOpen, setStartOpen] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [renaming, setRenaming] = useState<Renaming | null>(null)
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const [shutdown, setShutdown] = useState(false)
  const marqueeRef = useRef<Marquee | null>(null)
  const [positions, setPositions] = useState<Record<string, Pos>>(loadPositions)
  const [drag, setDrag] = useState<{ ids: string[]; dx: number; dy: number } | null>(null)
  const [dropFolder, setDropFolder] = useState<string | null>(null)
  const draggedRef = useRef(false)
  const activeId = topId()

  useEffect(() => {
    const onHash = () => setLogon(logonFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const dismiss = () => {
      setStartOpen(false)
      setCtxMenu(null)
      setMoveOpen(false)
    }
    window.addEventListener('pointerdown', dismiss)
    return () => window.removeEventListener('pointerdown', dismiss)
  }, [])

  // Del key deletes the selected desktop items (when nothing has focus).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return
      const el = document.activeElement
      if (el && el !== document.body && el.tagName !== 'DIV') return
      deleteSelection(selected)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  useEffect(() => {
    if (!session?.user) return
    loadFromServer()
    // A generation kept running server-side across the refresh — reopen the
    // studio so it can re-attach to the stream.
    try {
      const s = JSON.parse(localStorage.getItem('vibe95-studio') ?? 'null') as {
        activeJob?: unknown
      } | null
      if (s?.activeJob && !useWindows.getState().windows.some((w) => w.kind === 'studio')) {
        open('studio')
      }
    } catch {
      /* corrupt session, ignore */
    }
    // Fresh account: show the getting-started window once.
    if (localStorage.getItem('vibe95-welcome-pending')) {
      localStorage.removeItem('vibe95-welcome-pending')
      open('welcome', { title: 'Welcome to Vibe95' })
    }
    // An idea typed into the landing page demo: the studio picks it up.
    if (
      localStorage.getItem('vibe95-pending-prompt') &&
      !useWindows.getState().windows.some((w) => w.kind === 'studio')
    ) {
      open('studio')
    }
  }, [session?.user?.id])

  function launchExe(fileName: string) {
    // Open the window at the size the program was designed for, if it says.
    const size = extractSize(useFs.getState().files[fileName]?.html ?? '')
    open('exe', {
      title: fileName,
      payload: { fileName },
      ...(size ? exeWindowSize(size) : {}),
    })
  }

  function openFolder(name: string) {
    const existing = useWindows
      .getState()
      .windows.find((w) => w.kind === 'folder' && w.payload?.folder === name)
    if (existing) useWindows.getState().focus(existing.id)
    else open('folder', { title: name, payload: { folder: name } })
  }

  // The room is a single shared window: focus it if it's already open.
  function openChat() {
    const { windows, focus } = useWindows.getState()
    const existing = windows.find((w) => w.kind === 'chat')
    if (existing) focus(existing.id)
    else open('chat')
  }

  async function shareToChat(fileName: string) {
    // Share into whatever room the (possibly already open) chat window shows.
    const chatWin = useWindows.getState().windows.find((w) => w.kind === 'chat')
    const room = (chatWin?.payload?.room as string | undefined) ?? 'lobby'
    openChat()
    await fetch(
      `/api/chat/share/${encodeURIComponent(fileName)}?room=${encodeURIComponent(room)}`,
      { method: 'POST' }
    )
  }

  /* ---- selection ---------------------------------------------------- */

  function pressIcon(id: string, e: React.PointerEvent) {
    if (e.ctrlKey || e.metaKey) {
      setSelected((s) => {
        const next = new Set(s)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    } else if (!selected.has(id)) {
      setSelected(new Set([id]))
    }
    // A plain press on an already-selected icon keeps the group (so a
    // right-click can act on all of it); plain click collapses below.
  }

  function clickIcon(id: string, e: React.MouseEvent) {
    if (draggedRef.current) return
    if (!e.ctrlKey && !e.metaKey) setSelected(new Set([id]))
  }

  function deleteSelection(sel: ReadonlySet<string>) {
    for (const id of sel) {
      if (id.startsWith('__')) continue
      if (id.startsWith('dir:')) deleteFolder(id.slice(4))
      else deleteFile(id)
    }
    setSelected(new Set())
  }

  // Persist icon positions (cosmetic, per-browser).
  useEffect(() => {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(positions))
    } catch {
      /* quota, drop silently */
    }
  }, [positions])

  /* ---- icon drag & drop --------------------------------------------- */

  function startIconDrag(id: string, e: React.PointerEvent, layout: Record<string, Pos>) {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || renaming) return
    // Dragging an icon in the current selection drags the whole group.
    const ids = selected.has(id) ? [...new Set([...selected, id])] : [id]
    const sx = e.clientX
    const sy = e.clientY
    let moved = false
    let lastTarget: string | null = null

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return
      moved = true
      draggedRef.current = true
      setDrag({ ids, dx, dy })
      // Dragged icons have pointer-events:none, so this sees what's below.
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const drop = el?.closest('[data-drop-folder]') as HTMLElement | null
      let target = drop?.dataset.dropFolder ?? null
      // A folder can't be dropped into itself (or any folder).
      if (target !== null && ids.includes(dirId(target))) target = null
      if (target !== null && !ids.some((i) => !i.startsWith('__') && !i.startsWith('dir:'))) {
        target = null
      }
      lastTarget = target
      setDropFolder(target)
    }

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDrag(null)
      setDropFolder(null)
      if (!moved) return
      // Let the trailing click event see draggedRef before clearing it.
      setTimeout(() => {
        draggedRef.current = false
      }, 0)

      if (lastTarget !== null) {
        for (const dragged of ids) {
          if (dragged.startsWith('__') || dragged.startsWith('dir:')) continue
          moveFile(dragged, lastTarget)
        }
        setSelected(new Set())
        return
      }

      // Plain desktop drop: snap every dragged icon to the nearest cell.
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
      const maxX = window.innerWidth - 8 - 74
      const maxY = window.innerHeight - 36 - 66
      setPositions((prev) => {
        const next = { ...prev }
        for (const dragged of ids) {
          const from = layout[dragged]
          if (!from) continue
          const x = Math.round((from.x + dx) / GRID_X) * GRID_X
          const y = Math.round((from.y + dy) / GRID_Y) * GRID_Y
          next[dragged] = {
            x: Math.max(0, Math.min(x, maxX)),
            y: Math.max(0, Math.min(y, maxY)),
          }
        }
        return next
      })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /* ---- rubber-band selection ---------------------------------------- */

  function startMarquee(e: React.PointerEvent) {
    if (e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('.desktop-icon, .window, .taskbar, .context-menu, .start-menu')) return
    const start: Marquee = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY }
    marqueeRef.current = start
    setSelected(new Set())

    const onMove = (ev: PointerEvent) => {
      const m = marqueeRef.current
      if (!m) return
      const next = { ...m, x1: ev.clientX, y1: ev.clientY }
      marqueeRef.current = next
      if (Math.abs(next.x1 - next.x0) + Math.abs(next.y1 - next.y0) < 6) return
      setMarquee(next)
      const left = Math.min(next.x0, next.x1)
      const right = Math.max(next.x0, next.x1)
      const top = Math.min(next.y0, next.y1)
      const bottom = Math.max(next.y0, next.y1)
      const hit = new Set<string>()
      document.querySelectorAll<HTMLElement>('[data-desk-id]').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.left < right && r.right > left && r.top < bottom && r.bottom > top) {
          hit.add(el.dataset.deskId!)
        }
      })
      setSelected(hit)
    }
    const onUp = () => {
      marqueeRef.current = null
      setMarquee(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /* ---- rename ------------------------------------------------------- */

  function beginRename(target: CtxTarget) {
    if (target.kind === 'desktop') return
    setRenaming({ kind: target.kind, name: target.name, value: target.name })
  }

  async function commitRename() {
    if (!renaming) return
    const { kind, name, value } = renaming
    setRenaming(null)
    const trimmed = value.trim()
    if (!trimmed || trimmed === name) return
    const err = kind === 'file' ? await renameFile(name, trimmed) : await renameFolder(name, trimmed)
    if (err) return
    // Keep the icon's dragged-to spot across the rename.
    const oldKey = kind === 'file' ? name : dirId(name)
    const newKey = kind === 'file' ? normalizeExeName(trimmed) : dirId(trimmed.trim())
    setPositions((prev) => {
      if (!prev[oldKey] || oldKey === newKey) return prev
      const next = { ...prev }
      next[newKey] = next[oldKey]
      delete next[oldKey]
      return next
    })
  }

  async function newFolder() {
    const existing = useFs.getState().folders
    let name = 'New Folder'
    for (let i = 2; existing.includes(name); i++) name = `New Folder (${i})`
    const err = await createFolder(name)
    if (!err) setRenaming({ kind: 'folder', name, value: name })
  }

  function renameInput() {
    return (
      <input
        className="field rename-input"
        value={renaming!.value}
        autoFocus
        onFocus={(e) => e.target.select()}
        onChange={(e) => setRenaming((r) => r && { ...r, value: e.target.value })}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitRename()
          if (e.key === 'Escape') setRenaming(null)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      />
    )
  }

  if (shutdown) {
    return (
      <div className="shutdown-screen" onClick={() => location.reload()}>
        <span>
          It's now safe to turn off
          <br />
          your computer.
        </span>
      </div>
    )
  }

  if (isPending) {
    return <div className="desktop" />
  }

  if (!session?.user) {
    if (!logon) return <Landing />
    return (
      <Logon
        key={logon}
        initialMode={logon}
        onCancel={() => {
          clearHash()
          setLogon(null)
        }}
        onLoggedOn={() => {
          // Keep `logon` set: clearing it now would flash the landing page
          // until the session refetch lands.
          clearHash()
          refetch()
        }}
      />
    )
  }

  const exeList = Object.values(files)
    .filter((f) => !f.folder)
    .sort((a, b) => a.createdAt - b.createdAt)
  const folderList = [...folders].sort()
  const multi = ctxMenu?.target.kind === 'file' && selected.size > 1 && selected.has(ctxMenu.target.name)

  // Resolve every icon to a position: dragged-to spots from the positions
  // map, everything else flows into the free grid cells column by column
  // (the classic auto-arrange).
  const iconIds = [
    '__mycomputer',
    '__studio',
    '__chat',
    ...folderList.map(dirId),
    ...exeList.map((f) => f.name),
  ]
  const rows = Math.max(1, Math.floor((window.innerHeight - 40) / GRID_Y))
  const layout: Record<string, Pos> = {}
  const occupied = new Set<string>()
  for (const id of iconIds) {
    const p = positions[id]
    if (!p) continue
    layout[id] = p
    occupied.add(`${Math.round(p.x / GRID_X)},${Math.round(p.y / GRID_Y)}`)
  }
  let slot = 0
  for (const id of iconIds) {
    if (layout[id]) continue
    while (occupied.has(`${Math.floor(slot / rows)},${slot % rows}`)) slot++
    const col = Math.floor(slot / rows)
    const row = slot % rows
    layout[id] = { x: col * GRID_X, y: row * GRID_Y }
    occupied.add(`${col},${row}`)
    slot++
  }

  const iconStyle = (id: string): React.CSSProperties => {
    const p = layout[id]
    const dragging = drag?.ids.includes(id)
    return {
      left: p.x,
      top: p.y,
      transform: dragging ? `translate(${drag!.dx}px, ${drag!.dy}px)` : undefined,
      zIndex: dragging ? 5 : undefined,
    }
  }
  const iconClass = (id: string) =>
    'desktop-icon' +
    (selected.has(id) ? ' selected' : '') +
    (drag?.ids.includes(id) ? ' dragging' : '') +
    (dropFolder !== null && id === dirId(dropFolder) ? ' drop-target' : '')

  return (
    <div
      className="desktop"
      // Icons must NOT stopPropagation on pointerdown: the window-level
      // dismiss listener above relies on the event bubbling. The desktop
      // checks what was hit before clearing selection / starting a marquee.
      onPointerDown={(e) => {
        if (!(e.target as HTMLElement).closest('.desktop-icon')) setSelected(new Set())
        startMarquee(e)
      }}
      onContextMenu={(e) => {
        // Background right-click: the desktop's own menu (New Folder).
        const t = e.target as HTMLElement
        if (t.closest('.desktop-icon, .window, .taskbar, .context-menu, .start-menu')) return
        e.preventDefault()
        setCtxMenu({ x: e.clientX, y: e.clientY, target: { kind: 'desktop' } })
      }}
    >
      <div className="desktop-icons">
        <div
          className={iconClass('__mycomputer')}
          style={iconStyle('__mycomputer')}
          data-desk-id="__mycomputer"
          onPointerDown={(e) => {
            pressIcon('__mycomputer', e)
            startIconDrag('__mycomputer', e, layout)
          }}
          onClick={(e) => clickIcon('__mycomputer', e)}
          onDoubleClick={() => open('mycomputer')}
        >
          <ComputerIcon />
          <span className="icon-label">My Computer</span>
        </div>
        <div
          className={iconClass('__studio')}
          style={iconStyle('__studio')}
          data-desk-id="__studio"
          onPointerDown={(e) => {
            pressIcon('__studio', e)
            startIconDrag('__studio', e, layout)
          }}
          onClick={(e) => clickIcon('__studio', e)}
          onDoubleClick={() => open('studio')}
        >
          <StudioIcon />
          <span className="icon-label">Vibe Studio</span>
        </div>
        <div
          className={iconClass('__chat')}
          style={iconStyle('__chat')}
          data-desk-id="__chat"
          onPointerDown={(e) => {
            pressIcon('__chat', e)
            startIconDrag('__chat', e, layout)
          }}
          onClick={(e) => clickIcon('__chat', e)}
          onDoubleClick={openChat}
        >
          <ChatIcon />
          <span className="icon-label">Vibe Chat</span>
        </div>
        {folderList.map((name) => (
          <div
            key={dirId(name)}
            className={iconClass(dirId(name))}
            style={iconStyle(dirId(name))}
            data-desk-id={dirId(name)}
            data-drop-folder={name}
            onPointerDown={(e) => {
              pressIcon(dirId(name), e)
              startIconDrag(dirId(name), e, layout)
            }}
            onClick={(e) => clickIcon(dirId(name), e)}
            onDoubleClick={() => openFolder(name)}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!selected.has(dirId(name))) setSelected(new Set([dirId(name)]))
              setCtxMenu({ x: e.clientX, y: e.clientY, target: { kind: 'folder', name } })
            }}
          >
            <FolderIcon />
            {renaming?.kind === 'folder' && renaming.name === name ? (
              renameInput()
            ) : (
              <span className="icon-label">{name}</span>
            )}
          </div>
        ))}
        {exeList.map((f) => (
          <div
            key={f.name}
            className={iconClass(f.name)}
            style={iconStyle(f.name)}
            data-desk-id={f.name}
            onPointerDown={(e) => {
              pressIcon(f.name, e)
              startIconDrag(f.name, e, layout)
            }}
            onClick={(e) => clickIcon(f.name, e)}
            onDoubleClick={() => launchExe(f.name)}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!selected.has(f.name)) setSelected(new Set([f.name]))
              setCtxMenu({ x: e.clientX, y: e.clientY, target: { kind: 'file', name: f.name } })
            }}
          >
            <ProgramIcon icon={f.icon} />
            {renaming?.kind === 'file' && renaming.name === f.name ? (
              renameInput()
            ) : (
              <span className="icon-label">{f.name}</span>
            )}
          </div>
        ))}
      </div>

      {windows.map((w) => (
        <Window
          key={w.id}
          win={w}
          active={w.id === activeId}
          resizable={!DIALOG_KINDS.has(w.kind)}
          maximizable={!DIALOG_KINDS.has(w.kind)}
        >
          {w.kind === 'studio' && (
            <VibeStudio winId={w.id} editFile={w.payload?.editFile as string | undefined} />
          )}
          {w.kind === 'exe' && (
            <ExeRunner
              fileName={w.payload?.fileName as string | undefined}
              html={w.payload?.html as string | undefined}
              active={w.id === activeId}
            />
          )}
          {w.kind === 'mycomputer' && <MyComputer />}
          {w.kind === 'chat' && <VibeChat winId={w.id} />}
          {w.kind === 'newroom' && <NewRoomDialog winId={w.id} />}
          {w.kind === 'changeicon' && <ChangeIconDialog winId={w.id} />}
          {w.kind === 'upload' && <UploadDialog winId={w.id} />}
          {w.kind === 'properties' && <PropertiesDialog winId={w.id} />}
          {w.kind === 'folder' && <FolderView winId={w.id} />}
          {w.kind === 'welcome' && <Welcome winId={w.id} />}
          {w.kind === 'savedialog' && (
            <SaveDialog winId={w.id} html={w.payload?.html as string} />
          )}
        </Window>
      ))}

      {startOpen && (
        <StartMenu
          userEmail={session.user.email}
          onLaunch={(kind) => {
            if (kind === 'chat') openChat()
            else open(kind)
            setStartOpen(false)
          }}
          onLogOff={async () => {
            setStartOpen(false)
            await authClient.signOut()
            clearLocal()
            localStorage.removeItem('vibe95-studio')
            // Log Off goes back to the logon dialog, as in Windows 95.
            history.replaceState(null, '', '#logon')
            setLogon('signin')
            refetch()
          }}
          onShutdown={() => setShutdown(true)}
        />
      )}

      {marquee && (
        <div
          className="marquee"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}

      {ctxMenu && (
        <div
          className="context-menu"
          style={{ left: ctxMenu.x, top: Math.min(ctxMenu.y, window.innerHeight - 220) }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {ctxMenu.target.kind === 'desktop' && (
            <div
              className="menu-item"
              onClick={() => {
                newFolder()
                setCtxMenu(null)
              }}
            >
              New Folder
            </div>
          )}

          {ctxMenu.target.kind === 'folder' && (
            <>
              <div
                className="menu-item"
                onClick={() => {
                  openFolder((ctxMenu.target as { name: string }).name)
                  setCtxMenu(null)
                }}
              >
                <b>Open</b>
              </div>
              <div className="menu-sep" />
              <div
                className="menu-item"
                onClick={() => {
                  deleteFolder((ctxMenu.target as { name: string }).name)
                  setCtxMenu(null)
                }}
              >
                Delete
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  beginRename(ctxMenu.target)
                  setCtxMenu(null)
                }}
              >
                Rename
              </div>
            </>
          )}

          {ctxMenu.target.kind === 'file' && (
            <>
              <div
                className="menu-item"
                onClick={() => {
                  launchExe((ctxMenu.target as { name: string }).name)
                  setCtxMenu(null)
                }}
              >
                <b>Open</b>
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  const name = (ctxMenu.target as { name: string }).name
                  open('studio', {
                    title: `Vibe Studio - ${name}`,
                    payload: { editFile: name },
                  })
                  setCtxMenu(null)
                }}
              >
                Edit
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  shareToChat((ctxMenu.target as { name: string }).name)
                  setCtxMenu(null)
                }}
              >
                Share to Vibe Chat
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  open('changeicon', {
                    title: 'Change Icon',
                    payload: { fileName: (ctxMenu.target as { name: string }).name },
                  })
                  setCtxMenu(null)
                }}
              >
                Change Icon...
              </div>
              {folderList.length > 0 && (
                <div
                  className="menu-item menu-item-has-sub"
                  onMouseEnter={() => setMoveOpen(true)}
                  onMouseLeave={() => setMoveOpen(false)}
                >
                  Move to
                  <span className="menu-sub-arrow">▶</span>
                  {moveOpen && (
                    <div className="context-menu menu-sub">
                      <div
                        className="menu-item"
                        onClick={() => {
                          moveFile((ctxMenu.target as { name: string }).name, null)
                          setCtxMenu(null)
                          setMoveOpen(false)
                        }}
                      >
                        Desktop
                      </div>
                      {folderList.map((dir) => (
                        <div
                          key={dir}
                          className="menu-item"
                          onClick={() => {
                            moveFile((ctxMenu.target as { name: string }).name, dir)
                            setCtxMenu(null)
                            setMoveOpen(false)
                          }}
                        >
                          {dir}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="menu-sep" />
              <div
                className="menu-item"
                onClick={() => {
                  if (multi) deleteSelection(selected)
                  else deleteFile((ctxMenu.target as { name: string }).name)
                  setCtxMenu(null)
                }}
              >
                Delete{multi ? ` (${selected.size} items)` : ''}
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  beginRename(ctxMenu.target)
                  setCtxMenu(null)
                }}
              >
                Rename
              </div>
              <div className="menu-sep" />
              <div
                className="menu-item"
                onClick={() => {
                  open('properties', {
                    title: `${(ctxMenu.target as { name: string }).name} Properties`,
                    payload: { fileName: (ctxMenu.target as { name: string }).name },
                  })
                  setCtxMenu(null)
                }}
              >
                Properties
              </div>
            </>
          )}
        </div>
      )}

      <Taskbar startOpen={startOpen} onToggleStart={() => setStartOpen((v) => !v)} />
    </div>
  )
}
