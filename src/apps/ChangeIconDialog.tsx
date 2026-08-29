import { useState } from 'react'
import { useFs, useWindows } from '../store'
import { ICON_LIBRARY } from '../iconLibrary'
import { PixelIcon } from '../icons'

/** The classic shortcut-properties "Change Icon" dialog: a sunken well of
 * icons from the built-in Win95 set; pick one, OK. */
export function ChangeIconDialog({ winId }: { winId: string }) {
  const close = useWindows((s) => s.close)
  const setIcon = useFs((s) => s.setIcon)
  const payload = useWindows.getState().windows.find((w) => w.id === winId)?.payload
  const fileName = payload?.fileName as string
  const current = useFs.getState().files[fileName]?.icon ?? null
  const [selected, setSelected] = useState<string | null>(
    ICON_LIBRARY.find((i) => i.data === current)?.id ?? null
  )

  function ok() {
    const pick = ICON_LIBRARY.find((i) => i.id === selected)
    if (pick) setIcon(fileName, pick.data)
    close(winId)
  }

  return (
    <div className="dialog-body" style={{ height: '100%', boxSizing: 'border-box' }}>
      <div className="dialog-row">
        <span>Choose an icon for {fileName}:</span>
      </div>
      <div
        style={{
          background: '#fff',
          boxShadow: 'inset -1px -1px #fff, inset 1px 1px #808080, inset -2px -2px #dfdfdf, inset 2px 2px #0a0a0a',
          padding: 6,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          overflowY: 'auto',
          flex: 1,
          alignContent: 'flex-start',
        }}
      >
        {ICON_LIBRARY.map((i) => (
          <div
            key={i.id}
            title={i.name}
            onClick={() => setSelected(i.id)}
            onDoubleClick={() => {
              setIcon(fileName, i.data)
              close(winId)
            }}
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: selected === i.id ? '#000080' : 'transparent',
              cursor: 'default',
            }}
          >
            <PixelIcon data={i.data} size={32} />
          </div>
        ))}
      </div>
      <div className="dialog-actions">
        <button className="btn" onClick={ok} disabled={!selected}>
          OK
        </button>
        <button className="btn" onClick={() => close(winId)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
