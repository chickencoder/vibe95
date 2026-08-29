import { useState } from 'react'
import { useWindows } from '../store'
import { ChatIcon } from '../icons'

export function NewRoomDialog({ winId }: { winId: string }) {
  const close = useWindows((s) => s.close)
  const payload = useWindows.getState().windows.find((w) => w.id === winId)?.payload
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function create() {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    const res = await fetch('/api/chat/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(body?.error ?? 'Could not create the room.')
      setBusy(false)
      return
    }
    const body = (await res.json()) as { name: string }
    const onCreated = payload?.onCreated as ((room: string) => void) | undefined
    onCreated?.(body.name)
    close(winId)
  }

  return (
    <div className="dialog-body">
      <div className="dialog-row">
        <ChatIcon size={32} />
        <span>Room name:</span>
        <input
          className="field"
          style={{ flex: 1 }}
          value={name}
          maxLength={20}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create()
            if (e.key === 'Escape') close(winId)
          }}
        />
      </div>
      <div className="dialog-row" style={{ color: error ? '#800000' : '#404040' }}>
        {error ?? 'Letters, numbers, - or _ (20 characters max).'}
      </div>
      <div className="dialog-actions">
        <button className="btn" onClick={create} disabled={busy || !name.trim()}>
          OK
        </button>
        <button className="btn" onClick={() => close(winId)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
