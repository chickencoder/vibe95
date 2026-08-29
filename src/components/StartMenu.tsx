import { ChatIcon, ComputerIcon, StudioIcon } from '../icons'

export function StartMenu({
  userEmail,
  onLaunch,
  onLogOff,
  onShutdown,
}: {
  userEmail: string
  onLaunch: (kind: 'studio' | 'mycomputer' | 'welcome' | 'chat') => void
  onLogOff: () => void
  onShutdown: () => void
}) {
  return (
    <div className="start-menu" onPointerDown={(e) => e.stopPropagation()}>
      <div className="banner">
        <b>Vibe</b>95
      </div>
      <div className="menu-items">
        <div className="menu-item" onClick={() => onLaunch('studio')}>
          <StudioIcon size={24} />
          <span>
            <u>V</u>ibe Studio
          </span>
        </div>
        <div className="menu-item" onClick={() => onLaunch('chat')}>
          <ChatIcon size={24} />
          <span>
            Vibe Cha<u>t</u>
          </span>
        </div>
        <div className="menu-item" onClick={() => onLaunch('mycomputer')}>
          <ComputerIcon size={24} />
          <span>
            My <u>C</u>omputer
          </span>
        </div>
        <div className="menu-item" onClick={() => onLaunch('welcome')}>
          <svg className="icon-img" width="24" height="24" viewBox="0 0 32 32" style={{ shapeRendering: 'crispEdges' }}>
            <rect x="10" y="4" width="12" height="4" fill="#000080" />
            <rect x="8" y="8" width="6" height="4" fill="#000080" />
            <rect x="18" y="8" width="6" height="4" fill="#000080" />
            <rect x="16" y="12" width="6" height="4" fill="#000080" />
            <rect x="14" y="16" width="4" height="6" fill="#000080" />
            <rect x="14" y="25" width="4" height="4" fill="#000080" />
          </svg>
          <span>
            <u>H</u>elp
          </span>
        </div>
        <div className="menu-sep" />
        <div className="menu-item" onClick={onLogOff}>
          <svg className="icon-img" width="24" height="24" viewBox="0 0 32 32" style={{ shapeRendering: 'crispEdges' }}>
            <rect x="8" y="6" width="12" height="20" fill="#c0c0c0" />
            <rect x="8" y="6" width="12" height="1" fill="#ffffff" />
            <rect x="8" y="25" width="12" height="1" fill="#000000" />
            <rect x="18" y="14" width="10" height="4" fill="#000080" />
            <rect x="24" y="12" width="4" height="8" fill="#000080" />
          </svg>
          <span>
            <u>L</u>og Off {userEmail.split('@')[0]}...
          </span>
        </div>
        <div className="menu-item" onClick={onShutdown}>
          <svg className="icon-img" width="24" height="24" viewBox="0 0 32 32" style={{ shapeRendering: 'crispEdges' }}>
            <rect x="6" y="8" width="20" height="16" fill="#c0c0c0" />
            <rect x="6" y="8" width="20" height="1" fill="#ffffff" />
            <rect x="6" y="23" width="20" height="1" fill="#000000" />
            <rect x="13" y="12" width="6" height="8" fill="#000080" />
            <rect x="15" y="10" width="2" height="6" fill="#ff0000" />
          </svg>
          <span>
            Sh<u>u</u>t Down...
          </span>
        </div>
      </div>
    </div>
  )
}
