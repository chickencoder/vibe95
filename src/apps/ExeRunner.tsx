import { useEffect, useMemo, useRef } from 'react'
import { buildRunnerDoc } from '../runtime'
import { useFs } from '../store'

export function ExeRunner({
  fileName,
  html,
  active,
}: {
  fileName?: string
  html?: string
  active?: boolean
}) {
  const file = useFs((s) => (fileName ? s.files[fileName] : undefined))
  const frameRef = useRef<HTMLIFrameElement>(null)
  const content = html ?? file?.html
  const doc = useMemo(() => (content ? buildRunnerDoc(content) : null), [content])

  // Give the program keyboard focus when it loads and whenever its window
  // becomes the active one, so games respond to keys immediately.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const focusFrame = () => {
      frame.focus()
      // Focusing the element isn't always enough to move keyboard focus into
      // the sandboxed document; ask the injected focus shim to grab it.
      frame.contentWindow?.postMessage({ __vibe95Focus: true }, '*')
    }
    frame.addEventListener('load', focusFrame)
    if (active) focusFrame()
    return () => frame.removeEventListener('load', focusFrame)
  }, [doc, active])

  // Clicking anywhere on the surrounding window (titlebar included) moves
  // focus to the clicked element, which silently eats keystrokes. Hand focus
  // back to the program once the click completes.
  useEffect(() => {
    const frame = frameRef.current
    const winEl = frame?.closest('.window')
    if (!frame || !winEl) return
    const refocus = () => {
      frame.focus()
      frame.contentWindow?.postMessage({ __vibe95Focus: true }, '*')
    }
    winEl.addEventListener('pointerup', refocus)
    return () => winEl.removeEventListener('pointerup', refocus)
  }, [doc])

  if (!doc) {
    return (
      <div className="dialog-body" style={{ alignItems: 'center' }}>
        <span>{fileName ?? 'Program'} was not found. It may have been deleted.</span>
      </div>
    )
  }
  return (
    <iframe
      ref={frameRef}
      className="exe-frame"
      title={fileName ?? 'program'}
      sandbox="allow-scripts allow-modals allow-pointer-lock"
      srcDoc={doc}
    />
  )
}
