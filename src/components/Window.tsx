import { ReactNode, useCallback, useRef } from 'react'
import { WinState, useWindows } from '../store'
import { CloseGlyph, MaxGlyph, MinGlyph, RestoreGlyph, iconFor } from '../icons'

const TASKBAR_H = 28

export function Window({
  win,
  active,
  children,
  resizable = true,
  maximizable = true,
}: {
  win: WinState
  active: boolean
  children: ReactNode
  resizable?: boolean
  maximizable?: boolean
}) {
  const { focus, close, move, resize, toggleMinimize, toggleMaximize } = useWindows()
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)
  const sizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  const onTitlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('.tb-btn')) return
      if (win.maximized) return
      dragRef.current = { dx: e.clientX - win.x, dy: e.clientY - win.y }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [win.x, win.y, win.maximized]
  )

  const onTitlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      const x = Math.max(-win.w + 60, Math.min(e.clientX - dragRef.current.dx, window.innerWidth - 60))
      const y = Math.max(0, Math.min(e.clientY - dragRef.current.dy, window.innerHeight - TASKBAR_H - 18))
      move(win.id, x, y)
    },
    [move, win.id, win.w]
  )

  const endTitleDrag = useCallback(() => {
    dragRef.current = null
  }, [])

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      sizeRef.current = { x: e.clientX, y: e.clientY, w: win.w, h: win.h }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [win.w, win.h]
  )

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!sizeRef.current) return
      const w = Math.max(180, sizeRef.current.w + e.clientX - sizeRef.current.x)
      const h = Math.max(100, sizeRef.current.h + e.clientY - sizeRef.current.y)
      resize(win.id, w, h)
    },
    [resize, win.id]
  )

  const style = win.maximized
    ? { left: 0, top: 0, width: '100vw', height: `calc(100vh - ${TASKBAR_H}px)`, zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }

  if (win.minimized) return null

  return (
    <div
      className={`window${active ? '' : ' inactive'}`}
      style={style}
      onPointerDown={() => focus(win.id)}
    >
      <div
        className="titlebar"
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={endTitleDrag}
        onPointerCancel={endTitleDrag}
        onDoubleClick={() => maximizable && toggleMaximize(win.id)}
      >
        <span className="titlebar-icon">{iconFor(win.kind, 14)}</span>
        <span className="titlebar-text">{win.title}</span>
        <span className="titlebar-buttons">
          <button className="tb-btn" aria-label="Minimize" onClick={() => toggleMinimize(win.id)}>
            <MinGlyph />
          </button>
          {maximizable && (
            <button className="tb-btn" aria-label="Maximize" onClick={() => toggleMaximize(win.id)}>
              {win.maximized ? <RestoreGlyph /> : <MaxGlyph />}
            </button>
          )}
          <button
            className="tb-btn"
            aria-label="Close"
            style={{ marginLeft: 2 }}
            onClick={() => close(win.id)}
          >
            <CloseGlyph />
          </button>
        </span>
      </div>
      <div className="window-body">
        {children}
        {/* Iframes (program windows) swallow pointer events, so a click on a
            background window's content would never reach the focus handler
            above. A transparent catcher covers inactive windows; the first
            click focuses, then it disappears. */}
        {!active && <div className="focus-catcher" />}
      </div>
      {resizable && !win.maximized && (
        <div
          className="resize-handle"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={() => (sizeRef.current = null)}
          onPointerCancel={() => (sizeRef.current = null)}
        />
      )}
    </div>
  )
}
