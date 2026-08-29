import { useEffect, useState } from 'react'
import { exeWindowSize, useFs, useWindows } from '../store'
import { extractSize } from '../protocol'
import { ProgramIcon } from '../icons'

/** Contents of a desktop folder, Explorer-style. Payload: { folder }. */
export function FolderView({ winId }: { winId: string }) {
  const payload = useWindows.getState().windows.find((w) => w.id === winId)?.payload
  const folder = payload?.folder as string
  const files = useFs((s) => s.files)
  const moveFile = useFs((s) => s.moveFile)
  const deleteFile = useFs((s) => s.deleteFile)
  const { open } = useWindows()
  const [selected, setSelected] = useState<string | null>(null)
  const [ctx, setCtx] = useState<{ x: number; y: number; fileName: string } | null>(null)

  useEffect(() => {
    const dismiss = () => setCtx(null)
    window.addEventListener('pointerdown', dismiss)
    return () => window.removeEventListener('pointerdown', dismiss)
  }, [])

  const list = Object.values(files)
    .filter((f) => f.folder === folder)
    .sort((a, b) => a.name.localeCompare(b.name))

  function launch(fileName: string) {
    const size = extractSize(useFs.getState().files[fileName]?.html ?? '')
    open('exe', {
      title: fileName,
      payload: { fileName },
      ...(size ? exeWindowSize(size) : {}),
    })
  }

  return (
    <>
      {/* data-drop-folder: desktop icons dragged over this window drop in. */}
      <div className="file-list well" data-drop-folder={folder} onClick={() => setSelected(null)}>
        {list.map((f) => (
          <div
            key={f.name}
            className={`file-item${selected === f.name ? ' selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setSelected(f.name)
            }}
            onDoubleClick={() => launch(f.name)}
            onContextMenu={(e) => {
              e.preventDefault()
              setSelected(f.name)
              setCtx({ x: e.clientX, y: e.clientY, fileName: f.name })
            }}
          >
            <ProgramIcon icon={f.icon} size={32} />
            <span className="icon-label">{f.name}</span>
          </div>
        ))}
        {!list.length && (
          <span style={{ color: '#808080', padding: 4 }}>This folder is empty.</span>
        )}
      </div>
      <div className="statusbar">
        <div className="status-cell">{list.length} object(s)</div>
        <div className="status-cell" style={{ flex: 'none', minWidth: 120 }}>
          C:\Desktop\{folder}
        </div>
      </div>
      {ctx && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            left: ctx.x,
            top: Math.min(ctx.y, window.innerHeight - 110),
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="menu-item"
            onClick={() => {
              launch(ctx.fileName)
              setCtx(null)
            }}
          >
            <b>Open</b>
          </div>
          <div
            className="menu-item"
            onClick={() => {
              moveFile(ctx.fileName, null)
              setCtx(null)
            }}
          >
            Move to Desktop
          </div>
          <div className="menu-sep" />
          <div
            className="menu-item"
            onClick={() => {
              deleteFile(ctx.fileName)
              setCtx(null)
            }}
          >
            Delete
          </div>
        </div>
      )}
    </>
  )
}
