import { useEffect, useRef, useState } from 'react'
import { useFs, useWindows, type ExeFile } from '../store'

interface UserRef {
  id: string
  name: string
}

interface ShareInfo {
  shareId: string
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

// Classic IRC-style nick colors from the VGA palette (readable on white).
const NICK_COLORS = ['#000080', '#800000', '#008000', '#800080', '#008080', '#808000', '#0000ff', '#ff0000']

function nickColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return NICK_COLORS[Math.abs(h) % NICK_COLORS.length]
}

function timeStr(ts: number) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function VibeChat({ winId }: { winId: string }) {
  const [room, setRoom] = useState('lobby')
  const [rooms, setRooms] = useState<string[]>(['lobby'])
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [users, setUsers] = useState<UserRef[]>([])
  const [status, setStatus] = useState<'connecting' | 'online' | 'offline'>('connecting')
  const [input, setInput] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const open = useWindows((s) => s.open)
  const setTitle = useWindows((s) => s.setTitle)
  const updatePayload = useWindows((s) => s.updatePayload)
  const files = useFs((s) => s.files)
  const addLocal = useFs((s) => s.addLocal)

  const loadRooms = async () => {
    const res = await fetch('/api/chat/rooms')
    if (!res.ok) return
    const body = (await res.json()) as { rooms: string[] }
    if (body.rooms.length) setRooms(body.rooms)
  }

  useEffect(() => {
    loadRooms()
  }, [])

  // Advertise the active room on the window: the title bar shows it, and the
  // desktop right-click "Share to Vibe Chat" reads it from the payload.
  useEffect(() => {
    setTitle(winId, `Vibe Chat - #${room}`)
    updatePayload(winId, { room })
  }, [winId, room])

  useEffect(() => {
    let closed = false
    let ws: WebSocket | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    setMessages([])
    setUsers([])

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}/api/chat/ws?room=${encodeURIComponent(room)}`)
      wsRef.current = ws
      setStatus('connecting')
      ws.onopen = () => {
        attempts = 0
        setStatus('online')
      }
      ws.onmessage = (e) => {
        const ev = JSON.parse(e.data as string) as ServerEvent
        if (ev.t === 'hello') {
          setMessages(ev.history)
          setUsers(ev.users)
        } else if (ev.t === 'users') {
          setUsers(ev.users)
        } else {
          setMessages((m) => [...m.slice(-300), ev])
        }
      }
      ws.onclose = () => {
        if (closed) return
        setStatus('offline')
        retry = setTimeout(connect, Math.min(15_000, 1000 * 2 ** attempts++))
      }
    }
    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      ws?.close()
    }
  }, [room])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const send = () => {
    const text = input.trim()
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ t: 'chat', text }))
    setInput('')
  }

  const openNewRoomDialog = () => {
    open('newroom', {
      payload: {
        onCreated: async (name: string) => {
          await loadRooms()
          setRoom(name)
        },
      },
    })
  }

  const shareProgram = async (fileName: string) => {
    await fetch(`/api/chat/share/${encodeURIComponent(fileName)}?room=${encodeURIComponent(room)}`, {
      method: 'POST',
    })
  }

  const openUploadDialog = () => {
    open('upload', {
      title: 'Upload',
      payload: { onUpload: (name: string) => shareProgram(name) },
    })
  }

  const downloadShare = async (share: ShareInfo) => {
    const res = await fetch(`/api/chat/share/${share.shareId}/download`, { method: 'POST' })
    if (!res.ok) return
    const file = (await res.json()) as ExeFile
    addLocal(file)
    setMessages((m) => [
      ...m,
      { t: 'sys', text: `${file.name} was saved to your desktop`, ts: Date.now() },
    ])
  }

  const exeList = Object.values(files).sort((a, b) => a.createdAt - b.createdAt)

  return (
    <div className="chat-root">
      <div className="chat-toolbar">
        <span>Room:</span>
        <select
          className="field chat-room-select"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        >
          {rooms.map((r) => (
            <option key={r} value={r}>
              #{r}
            </option>
          ))}
        </select>
        <button className="btn" onClick={openNewRoomDialog}>
          New Room...
        </button>
      </div>
      <div className="chat-main">
        <div className="well chat-messages" ref={scrollRef}>
          {messages.map((m, i) =>
            m.t === 'sys' ? (
              <div key={i} className="chat-sys">
                *** {m.text}
              </div>
            ) : m.t === 'chat' ? (
              <div key={m.id} className="chat-line">
                <span className="chat-time">[{timeStr(m.ts)}]</span>{' '}
                <b style={{ color: nickColor(m.user.name) }}>&lt;{m.user.name}&gt;</b> {m.text}
              </div>
            ) : (
              <div key={m.id} className="chat-sys">
                <span className="chat-time">[{timeStr(m.ts)}]</span> *** {m.user.name} shared{' '}
                <a
                  className="chat-share-link"
                  title="Click to download to your desktop"
                  onClick={() => downloadShare(m.share)}
                >
                  {m.share.name}
                </a>
              </div>
            )
          )}
        </div>
        <div className="well chat-users">
          {users.map((u) => (
            <div key={u.id} className="chat-user">
              <span style={{ color: nickColor(u.name) }}>●</span> {u.name}
            </div>
          ))}
        </div>
      </div>
      <div className="chat-inputrow">
        <button className="btn" disabled={status !== 'online'} onClick={openUploadDialog}>
          Upload...
        </button>
        <input
          className="field"
          value={input}
          maxLength={500}
          placeholder={status === 'online' ? 'Say something...' : 'Connecting...'}
          disabled={status !== 'online'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="btn" onClick={send} disabled={status !== 'online' || !input.trim()}>
          Send
        </button>
      </div>
      <div className="statusbar">
        <span className="status-cell">
          {status === 'online'
            ? `#${room}: ${users.length} user${users.length === 1 ? '' : 's'} in the room`
            : status === 'connecting'
              ? `Connecting to #${room}...`
              : 'Disconnected. Reconnecting...'}
        </span>
        <span className="status-cell" style={{ flex: '0 0 auto' }}>
          Upload... posts one of your programs
        </span>
      </div>
    </div>
  )
}
