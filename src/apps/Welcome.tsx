import { useWindows } from '../store'
import { ExeIcon, StudioIcon } from '../icons'

export function Welcome({ winId }: { winId: string }) {
  const close = useWindows((s) => s.close)
  return (
    <div className="welcome">
      <div className="welcome-banner">
        <span className="welcome-banner-small">Welcome to</span>
        <span className="welcome-banner-big">Vibe95</span>
      </div>
      <div className="welcome-body">
        <div className="welcome-head">Getting Started</div>
        <div className="welcome-tip">
          <StudioIcon size={28} />
          <span>
            <b>1. Open Vibe Studio.</b> Double-click the Vibe Studio icon on your desktop.
          </span>
        </div>
        <div className="welcome-tip">
          <svg className="icon-img" width="28" height="28" viewBox="0 0 32 32" style={{ shapeRendering: 'crispEdges' }}>
            <rect x="4" y="6" width="24" height="16" fill="#ffffff" />
            <rect x="4" y="6" width="24" height="1" fill="#808080" />
            <rect x="4" y="6" width="1" height="16" fill="#808080" />
            <rect x="27" y="6" width="1" height="16" fill="#ffffff" />
            <rect x="7" y="10" width="14" height="2" fill="#000080" />
            <rect x="7" y="14" width="18" height="2" fill="#000080" />
            <rect x="10" y="24" width="2" height="4" fill="#000000" />
          </svg>
          <span>
            <b>2. Describe a program.</b> Type what you want, like "a snake game" or "a
            paint program", and press Vibe. Your program is written, tested, and opened
            for you.
          </span>
        </div>
        <div className="welcome-tip">
          <ExeIcon size={28} />
          <span>
            <b>3. Save it.</b> Save As... puts a real .EXE on your desktop. Double-click
            it to run, or right-click it to edit or delete. Your programs are stored in
            your account.
          </span>
        </div>
        <div className="welcome-tip">
          <svg className="icon-img" width="28" height="28" viewBox="0 0 32 32" style={{ shapeRendering: 'crispEdges' }}>
            <rect x="12" y="4" width="8" height="8" fill="#000080" />
            <rect x="10" y="14" width="8" height="4" fill="#000080" />
            <rect x="14" y="14" width="4" height="10" fill="#000080" />
            <rect x="12" y="26" width="8" height="2" fill="#000080" />
          </svg>
          <span>
            <b>Why is this free?</b> Vibe95 runs on the community-supported free models
            from OpenRouter, so every program you build costs nothing. Free models can be
            slower at busy times, and each account gets 100 builds per day. See the{' '}
            <a
              href="https://openrouter.ai/models?max_price=0"
              target="_blank"
              rel="noreferrer"
            >
              free models on OpenRouter
            </a>{' '}
            to learn more.
          </span>
        </div>
        <div className="welcome-footer">
          <span className="welcome-hint">Tip: keep asking for changes and your program is rewritten each time.</span>
          <button className="btn" onClick={() => close(winId)} autoFocus>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
