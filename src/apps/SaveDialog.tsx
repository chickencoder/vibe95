import { useState } from 'react'
import { normalizeExeName, useFs, useWindows } from '../store'
import { ExeIcon } from '../icons'

export function SaveDialog({ winId, html }: { winId: string; html: string }) {
  const { close, setTitle } = useWindows()
  const saveFile = useFs((s) => s.saveFile)
  const payload = useWindows.getState().windows.find((w) => w.id === winId)?.payload
  const suggested = (payload?.suggestedName as string | undefined)?.replace(/\.EXE$/i, '')
  const [name, setName] = useState(suggested ?? 'MYAPP')

  function save() {
    if (!name.trim()) return
    const final = saveFile(
      name,
      html,
      (payload?.icon as string | null | undefined) ?? undefined,
      (payload?.files as Record<string, string> | null | undefined) ?? undefined
    )
    const studioWinId = payload?.studioWinId as string | undefined
    if (studioWinId) setTitle(studioWinId, `Vibe Studio - ${final}`)
    const onSaved = payload?.onSaved as ((name: string) => void) | undefined
    onSaved?.(final)
    close(winId)
  }

  return (
    <div className="dialog-body">
      <div className="dialog-row">
        <ExeIcon size={32} />
        <span>File name:</span>
        <input
          className="field"
          style={{ flex: 1 }}
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </div>
      <div className="dialog-row" style={{ color: '#404040' }}>
        Saves as {normalizeExeName(name || 'MYAPP')} on the Desktop.
      </div>
      <div className="dialog-actions">
        <button className="btn" onClick={save}>
          Save
        </button>
        <button className="btn" onClick={() => close(winId)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
