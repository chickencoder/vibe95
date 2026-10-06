// Pixel-art style icons drawn on a 32x32 grid, rendered crisp via shape-rendering.
const P = { shapeRendering: 'crispEdges' as const }

export function ComputerIcon({ size = 32 }: { size?: number }) {
  return (
    <svg className="icon-img" width={size} height={size} viewBox="0 0 32 32" {...P}>
      <rect x="4" y="3" width="24" height="18" fill="#c0c0c0" />
      <rect x="4" y="3" width="24" height="1" fill="#ffffff" />
      <rect x="4" y="3" width="1" height="18" fill="#ffffff" />
      <rect x="27" y="3" width="1" height="18" fill="#000000" />
      <rect x="4" y="20" width="24" height="1" fill="#000000" />
      <rect x="7" y="6" width="18" height="12" fill="#008080" />
      <rect x="8" y="7" width="7" height="2" fill="#00ffff" />
      <rect x="12" y="23" width="8" height="2" fill="#c0c0c0" />
      <rect x="6" y="25" width="20" height="4" fill="#c0c0c0" />
      <rect x="6" y="25" width="20" height="1" fill="#ffffff" />
      <rect x="6" y="28" width="20" height="1" fill="#000000" />
      <rect x="22" y="26" width="2" height="1" fill="#00ff00" />
    </svg>
  )
}

export function StudioIcon({ size = 32 }: { size?: number }) {
  return (
    <svg className="icon-img" width={size} height={size} viewBox="0 0 32 32" {...P}>
      <rect x="3" y="4" width="26" height="24" fill="#c0c0c0" />
      <rect x="3" y="4" width="26" height="1" fill="#ffffff" />
      <rect x="3" y="4" width="1" height="24" fill="#ffffff" />
      <rect x="28" y="4" width="1" height="24" fill="#000000" />
      <rect x="3" y="27" width="26" height="1" fill="#000000" />
      <rect x="5" y="6" width="22" height="4" fill="#000080" />
      <rect x="24" y="7" width="2" height="2" fill="#c0c0c0" />
      <rect x="5" y="12" width="22" height="14" fill="#ffffff" />
      <rect x="7" y="14" width="8" height="2" fill="#ff00ff" />
      <rect x="7" y="17" width="12" height="2" fill="#0000ff" />
      <rect x="9" y="20" width="10" height="2" fill="#008000" />
      <rect x="7" y="23" width="6" height="2" fill="#ff0000" />
    </svg>
  )
}

export function ExeIcon({ size = 32 }: { size?: number }) {
  return (
    <svg className="icon-img" width={size} height={size} viewBox="0 0 32 32" {...P}>
      <rect x="4" y="3" width="24" height="26" fill="#c0c0c0" />
      <rect x="4" y="3" width="24" height="1" fill="#ffffff" />
      <rect x="4" y="3" width="1" height="26" fill="#ffffff" />
      <rect x="27" y="3" width="1" height="26" fill="#000000" />
      <rect x="4" y="28" width="24" height="1" fill="#000000" />
      <rect x="6" y="5" width="20" height="3" fill="#000080" />
      {/* windows flag */}
      <rect x="9" y="12" width="6" height="6" fill="#ff0000" />
      <rect x="17" y="12" width="6" height="6" fill="#00a000" />
      <rect x="9" y="20" width="6" height="6" fill="#0000ff" />
      <rect x="17" y="20" width="6" height="6" fill="#ffff00" />
    </svg>
  )
}

export function FlagIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...P}>
      <rect x="1" y="1" width="6" height="6" fill="#ff0000" />
      <rect x="9" y="1" width="6" height="6" fill="#00a000" />
      <rect x="1" y="9" width="6" height="6" fill="#0000ff" />
      <rect x="9" y="9" width="6" height="6" fill="#ffff00" />
    </svg>
  )
}

export function FolderIcon({ size = 32 }: { size?: number }) {
  return (
    <svg className="icon-img" width={size} height={size} viewBox="0 0 32 32" {...P}>
      <rect x="2" y="8" width="12" height="4" fill="#ffff00" />
      <rect x="2" y="10" width="28" height="16" fill="#ffff00" />
      <rect x="2" y="10" width="28" height="1" fill="#ffffff" />
      <rect x="2" y="8" width="1" height="18" fill="#ffffff" />
      <rect x="29" y="10" width="1" height="16" fill="#808000" />
      <rect x="2" y="25" width="28" height="1" fill="#808000" />
    </svg>
  )
}

/** A navy question mark, the Help glyph. */
export function HelpIcon({ size = 32 }: { size?: number }) {
  return (
    <svg className="icon-img" width={size} height={size} viewBox="0 0 32 32" {...P}>
      <rect x="10" y="4" width="12" height="4" fill="#000080" />
      <rect x="8" y="8" width="6" height="4" fill="#000080" />
      <rect x="18" y="8" width="6" height="4" fill="#000080" />
      <rect x="16" y="12" width="6" height="4" fill="#000080" />
      <rect x="14" y="16" width="4" height="6" fill="#000080" />
      <rect x="14" y="25" width="4" height="4" fill="#000080" />
    </svg>
  )
}

/** The Windows 95 logon key graphic — a gold key on a teal keyring card. */
export function LogonKeysIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" {...P}>
      {/* key shadow */}
      <rect x="7" y="25" width="30" height="4" fill="#808080" />
      {/* key bow (head) */}
      <rect x="6" y="14" width="12" height="12" fill="#ffff00" />
      <rect x="6" y="14" width="12" height="2" fill="#ffffff" />
      <rect x="6" y="14" width="2" height="12" fill="#ffffff" />
      <rect x="16" y="14" width="2" height="12" fill="#808000" />
      <rect x="6" y="24" width="12" height="2" fill="#808000" />
      <rect x="10" y="18" width="4" height="4" fill="#008080" />
      {/* key shaft */}
      <rect x="18" y="18" width="20" height="4" fill="#ffff00" />
      <rect x="18" y="18" width="20" height="1" fill="#ffffff" />
      <rect x="18" y="21" width="20" height="1" fill="#808000" />
      {/* key teeth */}
      <rect x="30" y="22" width="3" height="5" fill="#ffff00" />
      <rect x="30" y="26" width="3" height="1" fill="#808000" />
      <rect x="35" y="22" width="3" height="7" fill="#ffff00" />
      <rect x="35" y="28" width="3" height="1" fill="#808000" />
      {/* sparkle */}
      <rect x="24" y="10" width="1" height="5" fill="#ffffff" />
      <rect x="22" y="12" width="5" height="1" fill="#ffffff" />
    </svg>
  )
}

export function MinGlyph() {
  return (
    <svg width="8" height="7" viewBox="0 0 8 7" {...P}>
      <rect x="0" y="5" width="6" height="2" fill="#000" />
    </svg>
  )
}

export function MaxGlyph() {
  return (
    <svg width="9" height="8" viewBox="0 0 9 8" {...P}>
      <rect x="0" y="0" width="9" height="8" fill="none" stroke="#000" strokeWidth="1" />
      <rect x="0" y="0" width="9" height="2" fill="#000" />
    </svg>
  )
}

export function RestoreGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" {...P}>
      <rect x="2" y="0" width="7" height="2" fill="#000" />
      <rect x="8" y="0" width="1" height="5" fill="#000" />
      <rect x="6" y="5" width="3" height="1" fill="#000" />
      <rect x="0" y="3" width="7" height="2" fill="#000" />
      <rect x="0" y="3" width="1" height="6" fill="#000" />
      <rect x="6" y="3" width="1" height="6" fill="#000" />
      <rect x="0" y="8" width="7" height="1" fill="#000" />
    </svg>
  )
}

export function CloseGlyph() {
  return (
    <svg width="8" height="7" viewBox="0 0 8 7" {...P}>
      <rect x="0" y="0" width="2" height="1" fill="#000" />
      <rect x="6" y="0" width="2" height="1" fill="#000" />
      <rect x="1" y="1" width="2" height="1" fill="#000" />
      <rect x="5" y="1" width="2" height="1" fill="#000" />
      <rect x="2" y="2" width="4" height="1" fill="#000" />
      <rect x="3" y="3" width="2" height="1" fill="#000" />
      <rect x="2" y="4" width="4" height="1" fill="#000" />
      <rect x="1" y="5" width="2" height="1" fill="#000" />
      <rect x="5" y="5" width="2" height="1" fill="#000" />
      <rect x="0" y="6" width="2" height="1" fill="#000" />
      <rect x="6" y="6" width="2" height="1" fill="#000" />
    </svg>
  )
}

/** Two overlapping speech bubbles, MSN-chat style. */
export function ChatIcon({ size = 32 }: { size?: number }) {
  return (
    <svg className="icon-img" width={size} height={size} viewBox="0 0 32 32" style={{ shapeRendering: 'crispEdges' }}>
      <rect x="3" y="5" width="18" height="12" fill="#ffffff" />
      <rect x="3" y="5" width="18" height="1" fill="#000000" />
      <rect x="3" y="16" width="18" height="1" fill="#000000" />
      <rect x="3" y="5" width="1" height="12" fill="#000000" />
      <rect x="20" y="5" width="1" height="12" fill="#000000" />
      <rect x="6" y="17" width="3" height="3" fill="#ffffff" />
      <rect x="6" y="17" width="1" height="4" fill="#000000" />
      <rect x="6" y="20" width="4" height="1" fill="#000000" />
      <rect x="6" y="8" width="12" height="2" fill="#000080" />
      <rect x="6" y="12" width="9" height="2" fill="#000080" />
      <rect x="12" y="14" width="17" height="11" fill="#ffff00" />
      <rect x="12" y="14" width="17" height="1" fill="#000000" />
      <rect x="12" y="24" width="17" height="1" fill="#000000" />
      <rect x="12" y="14" width="1" height="11" fill="#000000" />
      <rect x="28" y="14" width="1" height="11" fill="#000000" />
      <rect x="23" y="25" width="3" height="3" fill="#ffff00" />
      <rect x="25" y="25" width="1" height="4" fill="#000000" />
      <rect x="22" y="28" width="4" height="1" fill="#000000" />
      <rect x="15" y="17" width="11" height="2" fill="#800000" />
      <rect x="15" y="21" width="8" height="2" fill="#800000" />
    </svg>
  )
}

const VGA = [
  '#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0',
  '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff',
]

/** Renders a model-drawn 16x16 icon (256 hex/'.' chars, row-major). */
export function PixelIcon({ data, size = 32 }: { data: string; size?: number }) {
  const rects = []
  for (let i = 0; i < 256 && i < data.length; i++) {
    const ch = data[i]
    if (ch === '.') continue
    const v = parseInt(ch, 16)
    if (Number.isNaN(v)) continue
    rects.push(<rect key={i} x={i % 16} y={Math.floor(i / 16)} width={1} height={1} fill={VGA[v]} />)
  }
  return (
    <svg className="icon-img" width={size} height={size} viewBox="0 0 16 16" style={{ shapeRendering: 'crispEdges' }}>
      {rects}
    </svg>
  )
}

/** The right icon for an .EXE: its generated one, or the generic fallback. */
export function ProgramIcon({ icon, size = 32 }: { icon?: string | null; size?: number }) {
  return icon ? <PixelIcon data={icon} size={size} /> : <ExeIcon size={size} />
}

export function iconFor(kind: string, size = 32) {
  switch (kind) {
    case 'studio':
      return <StudioIcon size={size} />
    case 'mycomputer':
      return <ComputerIcon size={size} />
    case 'welcome':
      return <FlagIcon size={size} />
    case 'exe':
      return <ExeIcon size={size} />
    case 'chat':
      return <ChatIcon size={size} />
    default:
      return <FolderIcon size={size} />
  }
}
