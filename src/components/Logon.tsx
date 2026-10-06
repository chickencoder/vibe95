import { useEffect, useState } from 'react'
import { authClient } from '../authClient'
import { CloseGlyph, FlagIcon } from '../icons'

export function Logon({
  initialMode = 'signin',
  onLoggedOn,
  onCancel,
}: {
  initialMode?: 'signin' | 'signup'
  onLoggedOn: () => void
  /** Back to the landing page. */
  onCancel: () => void
}) {
  const [mode, setMode] = useState(initialMode)
  const [identifier, setIdentifier] = useState('') // username or e-mail
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function signIn() {
    const id = identifier.trim()
    if (!id || !password) {
      setError('Type your user name and password.')
      return
    }
    setBusy(true)
    setError('')
    const { error: err } = id.includes('@')
      ? await authClient.signIn.email({ email: id.toLowerCase(), password })
      : await authClient.signIn.username({ username: id.toLowerCase(), password })
    setBusy(false)
    if (err) {
      setError(err.message || 'Logon failed. Check your user name and password.')
      return
    }
    onLoggedOn()
  }

  async function signUp() {
    const user = identifier.trim().toLowerCase()
    const addr = email.trim().toLowerCase()
    if (!/^[a-z0-9_\-.]{3,20}$/.test(user)) {
      setError('User name must be 3-20 characters (letters, numbers, _ - .).')
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      setError('Please enter a valid e-mail address.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setBusy(true)
    setError('')
    const { error: err } = await authClient.signUp.email({
      email: addr,
      password,
      name: user,
      username: user,
    })
    setBusy(false)
    if (err) {
      setError(err.message || 'Could not create the account.')
      return
    }
    // First logon: show the getting-started window once the desktop loads.
    localStorage.setItem('vibe95-welcome-pending', '1')
    onLoggedOn()
  }

  const submit = mode === 'signin' ? signIn : signUp

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return (
    <div
      className="desktop"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div className="window" style={{ position: 'relative', width: 400, maxWidth: 'calc(100vw - 32px)' }}>
        <div className="titlebar">
          <span className="titlebar-icon">
            <FlagIcon size={14} />
          </span>
          <span className="titlebar-text">
            {mode === 'signin' ? 'Welcome to Vibe95' : 'New User Account'}
          </span>
          <span className="titlebar-buttons">
            <button className="tb-btn" aria-label="Close" disabled={busy} onClick={onCancel}>
              <CloseGlyph />
            </button>
          </span>
        </div>
        <div className="window-body">
          <div className="dialog-body">
            <div className="dialog-row">
              <FlagIcon size={32} />
              <span>
                {mode === 'signin'
                  ? 'Type a user name and password to log on to Vibe95.'
                  : 'Choose a user name and password for your new Vibe95 account.'}
              </span>
            </div>
            <div className="dialog-row">
              <span style={{ minWidth: 78 }}>
                <u>U</u>ser name:
              </span>
              <input
                className="field"
                style={{ flex: 1 }}
                value={identifier}
                autoFocus
                disabled={busy}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
            {mode === 'signup' && (
              <div className="dialog-row">
                <span style={{ minWidth: 78 }}>
                  <u>E</u>-mail:
                </span>
                <input
                  className="field"
                  style={{ flex: 1 }}
                  value={email}
                  disabled={busy}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              </div>
            )}
            <div className="dialog-row">
              <span style={{ minWidth: 78 }}>
                <u>P</u>assword:
              </span>
              <input
                className="field"
                type="password"
                style={{ flex: 1 }}
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
            {error && (
              <div className="dialog-row" style={{ color: '#aa0000' }}>
                {error}
              </div>
            )}
            <div className="dialog-actions">
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin')
                  setError('')
                }}
              >
                {mode === 'signin' ? 'New User...' : 'Back'}
              </button>
              <span style={{ flex: 1 }} />
              <button className="btn" disabled={busy} onClick={submit}>
                {busy ? 'Working...' : mode === 'signin' ? 'OK' : 'Create'}
              </button>
              <button className="btn" disabled={busy} onClick={onCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
