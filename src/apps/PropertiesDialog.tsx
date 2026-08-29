import { useFs, useWindows } from '../store'
import { ProgramIcon } from '../icons'

function sizeStr(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`
  return `${(bytes / 1024).toFixed(1)}KB (${bytes.toLocaleString()} bytes)`
}

/** Win95 file-properties dialog (the General tab). Payload: { fileName }. */
export function PropertiesDialog({ winId }: { winId: string }) {
  const close = useWindows((s) => s.close)
  const payload = useWindows.getState().windows.find((w) => w.id === winId)?.payload
  const fileName = payload?.fileName as string
  const file = useFs.getState().files[fileName]

  if (!file) {
    close(winId)
    return null
  }
  const bytes = Object.values(file.files ?? { html: file.html }).reduce(
    (n, c) => n + c.length,
    0
  )
  const row = (label: string, value: string) => (
    <div className="dialog-row" style={{ alignItems: 'baseline' }}>
      <span style={{ width: 76, flex: 'none', color: '#000' }}>{label}:</span>
      <span>{value}</span>
    </div>
  )

  return (
    <div className="dialog-body" style={{ height: '100%', boxSizing: 'border-box' }}>
      <div className="dialog-row" style={{ gap: 12 }}>
        <ProgramIcon icon={file.icon} size={32} />
        <b>{file.name}</b>
      </div>
      <div style={{ borderTop: '1px solid #808080', borderBottom: '1px solid #fff' }} />
      {row('Type', 'Vibe95 Application')}
      {row('Location', file.folder ? `C:\\Desktop\\${file.folder}` : 'C:\\Desktop')}
      {row('Size', sizeStr(bytes))}
      {row('Contains', `${Object.keys(file.files ?? { 'index.html': 1 }).length} file(s)`)}
      <div style={{ borderTop: '1px solid #808080', borderBottom: '1px solid #fff' }} />
      {row('Created', new Date(file.createdAt).toLocaleString())}
      <div style={{ flex: 1 }} />
      <div className="dialog-actions">
        <button className="btn" onClick={() => close(winId)}>
          OK
        </button>
      </div>
    </div>
  )
}
