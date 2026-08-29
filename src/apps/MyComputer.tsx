import { useState } from 'react'
import { useFs, useWindows } from '../store'
import { ProgramIcon, StudioIcon } from '../icons'

export function MyComputer() {
  const files = useFs((s) => s.files)
  const { open } = useWindows()
  const [selected, setSelected] = useState<string | null>(null)
  const list = Object.values(files).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <div className="file-list well" onClick={() => setSelected(null)}>
        <div
          className={`file-item${selected === '__studio' ? ' selected' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            setSelected('__studio')
          }}
          onDoubleClick={() => open('studio')}
        >
          <StudioIcon size={32} />
          <span className="icon-label">Vibe Studio</span>
        </div>
        {list.map((f) => (
          <div
            key={f.name}
            className={`file-item${selected === f.name ? ' selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setSelected(f.name)
            }}
            onDoubleClick={() =>
              open('exe', { title: f.name, payload: { fileName: f.name } })
            }
          >
            <ProgramIcon icon={f.icon} size={32} />
            <span className="icon-label">{f.name}</span>
          </div>
        ))}
      </div>
      <div className="statusbar">
        <div className="status-cell">{list.length + 1} object(s)</div>
        <div className="status-cell" style={{ flex: 'none', minWidth: 90 }}>
          C:\
        </div>
      </div>
    </>
  )
}
