import { useState } from 'react'
import { useFs, useWindows } from '../store'
import { FolderIcon, ProgramIcon } from '../icons'

/** Win95 Open-dialog style file picker for sharing a program into Vibe Chat.
 * Payload: { onUpload: (fileName: string) => void }. */
export function UploadDialog({ winId }: { winId: string }) {
  const close = useWindows((s) => s.close)
  const payload = useWindows.getState().windows.find((w) => w.id === winId)?.payload
  const onUpload = payload?.onUpload as ((name: string) => void) | undefined
  const files = useFs((s) => s.files)
  const folders = useFs((s) => s.folders)
  const [lookIn, setLookIn] = useState<string>('__desktop')
  const [selected, setSelected] = useState<string | null>(null)

  const list = Object.values(files)
    .filter((f) => (lookIn === '__desktop' ? !f.folder : f.folder === lookIn))
    .sort((a, b) => a.name.localeCompare(b.name))
  // Folders show inside the Desktop view, like the real Open dialog.
  const folderList = lookIn === '__desktop' ? [...folders].sort() : []

  function upload() {
    if (!selected) return
    onUpload?.(selected)
    close(winId)
  }

  return (
    <div className="dialog-body" style={{ height: '100%', boxSizing: 'border-box' }}>
      <div className="dialog-row">
        <span>Look in:</span>
        <select
          className="field"
          style={{ flex: 1 }}
          value={lookIn}
          onChange={(e) => {
            setLookIn(e.target.value)
            setSelected(null)
          }}
        >
          <option value="__desktop">Desktop</option>
          {[...folders].sort().map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div
        className="file-list well"
        style={{ flex: 1, overflowY: 'auto' }}
        onClick={() => setSelected(null)}
      >
        {folderList.map((f) => (
          <div
            key={`dir:${f}`}
            className="file-item"
            onClick={(e) => {
              e.stopPropagation()
              setLookIn(f)
              setSelected(null)
            }}
            onDoubleClick={() => {
              setLookIn(f)
              setSelected(null)
            }}
          >
            <FolderIcon size={32} />
            <span className="icon-label">{f}</span>
          </div>
        ))}
        {list.map((f) => (
          <div
            key={f.name}
            className={`file-item${selected === f.name ? ' selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setSelected(f.name)
            }}
            onDoubleClick={() => {
              setSelected(f.name)
              onUpload?.(f.name)
              close(winId)
            }}
          >
            <ProgramIcon icon={f.icon} size={32} />
            <span className="icon-label">{f.name}</span>
          </div>
        ))}
        {!list.length && !folderList.length && (
          <span style={{ color: '#808080', padding: 4 }}>No programs here yet.</span>
        )}
      </div>
      <div className="dialog-row">
        <span>File name:</span>
        <input className="field" style={{ flex: 1 }} value={selected ?? ''} readOnly />
      </div>
      <div className="dialog-actions">
        <button className="btn" onClick={upload} disabled={!selected}>
          Upload
        </button>
        <button className="btn" onClick={() => close(winId)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
