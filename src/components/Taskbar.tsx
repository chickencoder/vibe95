import { useEffect, useState } from 'react'
import { useWindows } from '../store'
import { FlagIcon, iconFor } from '../icons'

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])
  const hh = now.getHours() % 12 || 12
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM'
  return (
    <span>
      {hh}:{mm} {ampm}
    </span>
  )
}

export function Taskbar({
  startOpen,
  onToggleStart,
}: {
  startOpen: boolean
  onToggleStart: () => void
}) {
  const { windows, focus, toggleMinimize, topId } = useWindows()
  const activeId = topId()

  return (
    <div className="taskbar">
      <button
        className={`btn start-btn${startOpen ? ' open' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onToggleStart()
        }}
      >
        <FlagIcon size={16} />
        Start
      </button>
      <div style={{ width: 1, alignSelf: 'stretch', margin: '2px 1px', boxShadow: 'inset 1px 0 #808080, inset -1px 0 #ffffff' }} />
      {windows.map((w) => {
        const isActive = w.id === activeId && !w.minimized
        return (
          <button
            key={w.id}
            className={`btn task-btn${isActive ? ' active' : ''}`}
            onClick={() => {
              if (isActive) toggleMinimize(w.id)
              else focus(w.id)
            }}
          >
            {iconFor(w.kind, 14)}
            <span className="task-label">{w.title}</span>
          </button>
        )
      })}
      <div className="taskbar-tray">
        <Clock />
      </div>
    </div>
  )
}
