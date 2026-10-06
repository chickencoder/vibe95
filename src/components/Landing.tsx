import { useEffect, useRef, useState, type ReactNode } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import {
  ChatIcon,
  CloseGlyph,
  ComputerIcon,
  ExeIcon,
  FlagIcon,
  FolderIcon,
  HelpIcon,
  LogonKeysIcon,
  StudioIcon,
} from '../icons'
import { StepRow } from '../apps/VibeStudio'
import { Clock } from './Taskbar'

/* The signed-out front page. Logon and sign-up live behind #logon and
 * #new-user (App watches the hash), so every call to action is a plain link
 * and the browser Back button returns here. */

/** The program the hero demo "writes". It is also what PONG.EXE runs. */
const PONG_SRC = `<!DOCTYPE html>
<html>
<head>
<title>Pong</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; }
  canvas { width: 100%; height: 100%; object-fit: contain; }
</style>
</head>
<body>
<canvas id="c" width="320" height="200"></canvas>
<script>
const c = document.getElementById('c');
const g = c.getContext('2d');
let ball = { x: 160, y: 100, dx: 3, dy: 2 };
let you = 80, cpu = 80, mouse = null;
const score = [0, 0];

// Move the mouse to play. Until then, it plays itself.
c.addEventListener('mousemove', (e) => {
  mouse = (e.offsetY / c.clientHeight) * 200;
});
c.addEventListener('mouseleave', () => (mouse = null));

function tick() {
  ball.x += ball.dx;
  ball.y += ball.dy;
  if (ball.y < 0 || ball.y > 196) ball.dy = -ball.dy;

  you += ((mouse ?? ball.y) - you - 20) * (mouse === null ? 0.1 : 0.5);
  cpu += (ball.y - cpu - 20) * 0.07;

  if (ball.x < 14 && ball.y > you - 4 && ball.y < you + 40) ball.dx = Math.abs(ball.dx);
  if (ball.x > 302 && ball.y > cpu - 4 && ball.y < cpu + 40) ball.dx = -Math.abs(ball.dx);
  if (ball.x < -8 || ball.x > 328) {
    score[ball.x < 0 ? 1 : 0]++;
    ball = { x: 160, y: 100, dx: ball.x < 0 ? 3 : -3, dy: Math.random() * 4 - 2 };
  }

  g.fillStyle = '#000';
  g.fillRect(0, 0, 320, 200);
  g.fillStyle = '#0f0';
  for (let y = 0; y < 200; y += 10) g.fillRect(159, y, 2, 5);
  g.fillRect(8, you, 6, 40);
  g.fillRect(306, cpu, 6, 40);
  g.fillRect(ball.x, ball.y, 4, 4);
  g.font = '16px monospace';
  g.fillText(score[0] + '   ' + score[1], 136, 20);
  requestAnimationFrame(tick);
}
tick();
</script>
</body>
</html>
`

const DEMO_PROMPT = 'a pong game with a CPU opponent'

/* Demo timeline, in ms from the start of a run. */
const TYPE_START = 600
const MS_PER_PROMPT_CHAR = 55
const SEND_AT = 2600
const CONTACTED_AT = 3200
const THOUGHT_AT = 4700
const MS_PER_CODE_CHAR = 2.2
const WRITTEN_AT = THOUGHT_AT + PONG_SRC.length * MS_PER_CODE_CHAR
const TESTED_AT = WRITTEN_AT + 1000
const DEMO_END = TESTED_AT + 300

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** A scripted Vibe Studio session: type a prompt, stream the code, run it. */
function HeroDemo() {
  const reduced = useRef(prefersReducedMotion()).current
  const [run, setRun] = useState(0)
  // Reduced motion: start on the finished program, nothing auto-plays.
  const [t, setT] = useState(reduced ? DEMO_END : 0)
  const [pongOpen, setPongOpen] = useState(false)
  const [idea, setIdea] = useState('')
  const codeRef = useRef<HTMLDivElement>(null)
  const ideaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (reduced && run === 0) return
    setPongOpen(false)
    setT(0)
    const start = performance.now()
    let raf = 0
    const step = () => {
      const now = performance.now() - start
      setT(Math.min(now, DEMO_END))
      if (now < DEMO_END) raf = requestAnimationFrame(step)
      else setPongOpen(true)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [run])

  const done = t >= DEMO_END
  const sent = t >= SEND_AT
  const typed = DEMO_PROMPT.slice(0, clamp(Math.floor((t - TYPE_START) / MS_PER_PROMPT_CHAR), 0, DEMO_PROMPT.length))
  const codeLen = clamp(Math.floor((t - THOUGHT_AT) / MS_PER_CODE_CHAR), 0, PONG_SRC.length)
  const thinkChars = Math.floor(clamp((t - CONTACTED_AT) / (THOUGHT_AT - CONTACTED_AT), 0, 1) * 3140)
  const at = t < CONTACTED_AT ? 0 : t < THOUGHT_AT ? 1 : t < WRITTEN_AT ? 2 : 3
  const stateOf = (i: number) => (i < at ? 'done' : i === at ? 'active' : 'pending')
  const highlighted = codeLen ? Prism.highlight(PONG_SRC.slice(0, codeLen), Prism.languages.markup, 'markup') : ''

  // Follow the stream, like the real code view.
  useEffect(() => {
    const el = codeRef.current
    if (el && !done) el.scrollTop = el.scrollHeight
  }, [codeLen, done])

  function tryIdea() {
    const text = idea.trim()
    if (!text) {
      ideaRef.current?.focus()
      return
    }
    try {
      localStorage.setItem('vibe95-pending-prompt', text)
    } catch {
      /* storage blocked: they retype it in the studio */
    }
    location.hash = 'new-user'
  }

  return (
    <div className="landing-demo">
      <div className="window landing-studio" role="group" aria-label="Vibe Studio demo">
        <div className="titlebar">
          <span className="titlebar-icon">
            <StudioIcon size={14} />
          </span>
          <span className="titlebar-text">{done ? 'PONG.EXE - Vibe Studio' : 'Vibe Studio'}</span>
        </div>
        <div className="window-body studio">
          <div className="studio-toolbar">
            <button className="btn" style={{ minWidth: 50 }} onClick={() => setRun((r) => r + 1)} disabled={!done}>
              New
            </button>
            <a
              className={`btn landing-btn-link${done ? '' : ' disabled'}`}
              style={{ minWidth: 70 }}
              href="#new-user"
              title="Make a free account to save programs"
              aria-disabled={!done}
              tabIndex={done ? undefined : -1}
            >
              Save As...
            </a>
            <button
              className="btn"
              style={{ minWidth: 64, fontWeight: 700 }}
              onClick={() => setPongOpen(true)}
              disabled={!done}
            >
              &#9654; Play
            </button>
          </div>
          <div className="studio-main landing-studio-main">
            <div className="studio-chat landing-studio-chat">
              <div className="chat-log well">
                <div className="chat-msg assistant">
                  <span className="who">Vibe Studio:</span> Describe the program you want to build.
                </div>
                {sent && (
                  <div className="chat-msg user">
                    <span className="who">You:</span> {DEMO_PROMPT}
                  </div>
                )}
                {done && (
                  <div className="chat-msg assistant">
                    <span className="who">Vibe Studio:</span> PONG.EXE is ready. Now you try: type
                    your own idea below.
                  </div>
                )}
              </div>
              {sent && !done && (
                <div className="gen-progress">
                  <div className="gen-progress-title">Building your program</div>
                  <StepRow state={stateOf(0)}>Contacting the AI</StepRow>
                  <StepRow
                    state={stateOf(1)}
                    detail={thinkChars ? `${thinkChars.toLocaleString()} characters of thought` : undefined}
                    note="It plans before it writes. At length."
                  >
                    Thinking it through
                  </StepRow>
                  <StepRow
                    state={stateOf(2)}
                    detail={codeLen ? `index.html, ${codeLen.toLocaleString()} characters written` : undefined}
                  >
                    Writing the code
                  </StepRow>
                  <StepRow state={stateOf(3)}>Testing the program</StepRow>
                </div>
              )}
              <form
                className="chat-input-row"
                onSubmit={(e) => {
                  e.preventDefault()
                  tryIdea()
                }}
              >
                <input
                  ref={ideaRef}
                  className="field landing-idea"
                  aria-label="Describe a program"
                  placeholder={done ? 'e.g. a snake game' : ''}
                  value={done ? idea : sent ? '' : typed}
                  readOnly={!done}
                  maxLength={500}
                  onChange={(e) => setIdea(e.target.value)}
                />
                <button
                  className={`btn${t >= SEND_AT - 180 && !sent ? ' landing-pressed' : ''}`}
                  style={{ minWidth: 56 }}
                  disabled={!done}
                >
                  Vibe
                </button>
              </form>
            </div>
            <div className="studio-code">
              <div className="pane-caption">{codeLen ? 'index.html' : 'No file open'}</div>
              {highlighted ? (
                <div
                  className="code-view well"
                  ref={codeRef}
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                />
              ) : (
                <div className="code-view well placeholder">Code appears here as it is written.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {pongOpen && (
        <div className="window landing-pong">
          <div className="titlebar">
            <span className="titlebar-icon">
              <ExeIcon size={14} />
            </span>
            <span className="titlebar-text">PONG.EXE</span>
            <span className="titlebar-buttons">
              <button className="tb-btn" aria-label="Close" onClick={() => setPongOpen(false)}>
                <CloseGlyph />
              </button>
            </span>
          </div>
          <div className="window-body">
            <iframe className="exe-frame" title="PONG.EXE" sandbox="allow-scripts" srcDoc={PONG_SRC} />
          </div>
        </div>
      )}
    </div>
  )
}

function Win({
  title,
  icon,
  className,
  children,
}: {
  title: string
  icon: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`window landing-win${className ? ` ${className}` : ''}`}>
      <div className="titlebar">
        <span className="titlebar-icon">{icon}</span>
        <h3 className="titlebar-text">{title}</h3>
      </div>
      <div className="window-body">{children}</div>
    </div>
  )
}

function CheckIcon({ size = 32 }: { size?: number }) {
  return (
    <svg className="icon-img" width={size} height={size} viewBox="0 0 32 32" style={{ shapeRendering: 'crispEdges' }}>
      <rect x="4" y="4" width="24" height="24" fill="#ffffff" />
      <rect x="4" y="4" width="24" height="1" fill="#808080" />
      <rect x="4" y="4" width="1" height="24" fill="#808080" />
      <rect x="27" y="4" width="1" height="24" fill="#000000" />
      <rect x="4" y="27" width="24" height="1" fill="#000000" />
      <rect x="8" y="15" width="3" height="3" fill="#008000" />
      <rect x="11" y="18" width="3" height="3" fill="#008000" />
      <rect x="14" y="15" width="3" height="3" fill="#008000" />
      <rect x="17" y="12" width="3" height="3" fill="#008000" />
      <rect x="20" y="9" width="3" height="3" fill="#008000" />
    </svg>
  )
}

const STEPS: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <StudioIcon />,
    title: '1. Open Vibe Studio',
    text: 'Log on and double-click Vibe Studio on your desktop.',
  },
  {
    icon: (
      <svg className="icon-img" width="32" height="32" viewBox="0 0 32 32" style={{ shapeRendering: 'crispEdges' }}>
        <rect x="4" y="6" width="24" height="16" fill="#ffffff" />
        <rect x="4" y="6" width="24" height="1" fill="#808080" />
        <rect x="4" y="6" width="1" height="16" fill="#808080" />
        <rect x="27" y="6" width="1" height="16" fill="#ffffff" />
        <rect x="7" y="10" width="14" height="2" fill="#000080" />
        <rect x="7" y="14" width="18" height="2" fill="#000080" />
        <rect x="10" y="24" width="2" height="4" fill="#000000" />
      </svg>
    ),
    title: '2. Describe a program',
    text: 'Type what you want, like "a snake game" or "a paint program", and press Vibe.',
  },
  {
    icon: <CheckIcon />,
    title: '3. Watch it get built',
    text: 'The code streams in as it is written. Then it is tested, and it opens in its own window.',
  },
  {
    icon: <ExeIcon />,
    title: '4. Save it as a .EXE',
    text: 'Save As... puts it on your desktop. Double-click to run it. Ask for changes and it is rewritten.',
  },
]

type Icon = (props: { size?: number }) => ReactNode

const FEATURES: { Icon: Icon; title: string; text: string }[] = [
  {
    Icon: StudioIcon,
    title: 'Watch it write',
    text: 'The code streams into the editor line by line, with syntax colors, while the AI writes it.',
  },
  {
    Icon: CheckIcon,
    title: 'It tests its own work',
    text: 'Before launch, every script gets a syntax check and the program runs in a hidden sandbox. If it breaks, the AI gets the error and fixes it.',
  },
  {
    Icon: ExeIcon,
    title: 'Real .EXE files',
    text: 'Programs live on your desktop as .EXE files. Rename them, change their icons, and sort them into folders.',
  },
  {
    Icon: FolderIcon,
    title: 'Saved in the cloud',
    text: 'Your desktop is stored in your account. Log on from a different computer and your programs are there.',
  },
  {
    Icon: ChatIcon,
    title: 'Vibe Chat',
    text: 'Chat rooms inside the desktop. Share a .EXE in a room and other people can put a copy on their desktop.',
  },
  {
    Icon: ComputerIcon,
    title: 'Survives a refresh',
    text: 'Each build runs on the server. Close the tab in the middle of a build, come back, and it continues.',
  },
]

const ORDER: [string, string][] = [
  ['Vibe95 Professional Edition', '$0.00'],
  ['AI code generation, 100 builds a day', '$0.00'],
  ['Cloud storage for your .EXE files', '$0.00'],
  ['Multiplayer chat rooms', '$0.00'],
  ['Priority support (there is none)', '$0.00'],
]

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'Is it really free?',
    a: (
      <>
        Yes. There is no card, no trial, and no paid plan. Vibe95 runs on the community-supported
        free models from{' '}
        <a href="https://openrouter.ai/models?max_price=0" target="_blank" rel="noreferrer">
          OpenRouter
        </a>
        , so a build costs nothing. Each account gets 100 builds a day.
      </>
    ),
  },
  {
    q: 'What can I build?',
    a: 'Anything that runs on one web page: games, toys, and small tools. Try a snake game, a paint program, a drum machine, or a calculator that looks like it is from 1995.',
  },
  {
    q: 'Do I have to install something?',
    a: 'No. Vibe95 runs in your web browser, and so do the programs you make.',
  },
  {
    q: 'Can I change a program after it is built?',
    a: 'Yes. Type the change in Vibe Studio and the program is rewritten. To change a saved .EXE later, right-click it and choose Edit.',
  },
  {
    q: 'Why is it slow sometimes?',
    a: 'Free models are shared by many people. At busy times they take longer to think. The progress window shows you what is happening.',
  },
  {
    q: 'Is this Windows?',
    a: 'No. Vibe95 is a web app that looks like Windows 95. It is not affiliated with Microsoft.',
  },
]

function StartMenu({ onClose }: { onClose: () => void }) {
  const item = (href: string, icon: ReactNode, label: ReactNode) => (
    <a className="menu-item" href={href} onClick={onClose}>
      {icon}
      <span>{label}</span>
    </a>
  )
  return (
    <nav className="start-menu landing-start-menu" aria-label="Start menu" onPointerDown={(e) => e.stopPropagation()}>
      <div className="banner">
        <b>Vibe</b>95
      </div>
      <div className="menu-items">
        {item('#new-user', <FlagIcon size={24} />, <><u>N</u>ew User...</>)}
        {item('#logon', <LogonKeysIcon size={24} />, <><u>L</u>og On...</>)}
        <div className="menu-sep" />
        {item('#how-it-works', <StudioIcon size={24} />, 'How It Works')}
        {item('#features', <ComputerIcon size={24} />, 'Features')}
        {item('#pricing', <ExeIcon size={24} />, 'Pricing')}
        {item('#help', <HelpIcon size={24} />, 'Help')}
      </div>
    </nav>
  )
}

export function Landing() {
  const [startOpen, setStartOpen] = useState(false)
  const [payError, setPayError] = useState(false)

  useEffect(() => {
    const dismiss = () => setStartOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setStartOpen(false)
      setPayError(false)
    }
    window.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="landing">
      <main className="landing-page">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <h1 className="landing-title">
              <span className="landing-logo">Vibe95</span>
              <span className="landing-tagline">Vibe code apps in Windows 95.</span>
            </h1>
            <div className="landing-badge">100% FREE. FOREVER. WE CHECKED.</div>
            <p className="landing-lede">
              Describe a program. Watch the AI write it. It opens in its own window when it is
              done, and Save As... puts a .EXE on your desktop.
            </p>
            <div className="landing-cta">
              <a className="btn landing-btn-link landing-btn-big" href="#new-user">
                Start Vibing
              </a>
              <a className="btn landing-btn-link landing-btn-big landing-btn-plain" href="#logon">
                Log On...
              </a>
            </div>
            <p className="landing-note">No card. No trial. No "contact sales".</p>
          </div>
          <HeroDemo />
        </section>

        <section className="landing-section" id="how-it-works">
          <h2 className="landing-h2">How it works</h2>
          <Win title="Getting Started" icon={<FlagIcon size={14} />}>
            <ol className="landing-steps">
              {STEPS.map((s) => (
                <li key={s.title} className="landing-step">
                  {s.icon}
                  <div>
                    <b>{s.title}</b>
                    <p>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Win>
        </section>

        <section className="landing-section" id="features">
          <h2 className="landing-h2">What is in the box</h2>
          <div className="landing-features">
            {FEATURES.map(({ Icon, title, text }) => (
              <Win key={title} title={title} icon={<Icon size={14} />}>
                <div className="landing-feature">
                  <Icon />
                  <p>{text}</p>
                </div>
              </Win>
            ))}
          </div>
        </section>

        <section className="landing-section" id="pricing">
          <h2 className="landing-h2">Pricing</h2>
          <div className="landing-pricing">
            <Win title="Vibe95 Setup - Order Summary" icon={<ExeIcon size={14} />} className="landing-order">
              <div className="landing-order-body">
                {ORDER.map(([item, price]) => (
                  <div key={item} className="landing-order-row">
                    <span>{item}</span>
                    <span className="landing-order-dots" />
                    <b>{price}</b>
                  </div>
                ))}
                <div className="landing-order-total">
                  <b>TOTAL DUE TODAY</b>
                  <span className="landing-order-sum">$0.00</span>
                </div>
                <div className="dialog-actions">
                  <button className="btn" onClick={() => setPayError(true)}>
                    Pay Now
                  </button>
                  <a className="btn landing-btn-link" href="#new-user">
                    Get It Free
                  </a>
                </div>
              </div>
              {payError && (
                <div className="window landing-error" role="alertdialog" aria-labelledby="landing-error-text">
                  <div className="titlebar">
                    <span className="titlebar-text">Vibe95</span>
                  </div>
                  <div className="window-body">
                    <div className="dialog-body">
                      <div className="dialog-row">
                        <span className="landing-stop" aria-hidden>
                          x
                        </span>
                        <span id="landing-error-text">Payment failed. There is nothing to pay for.</span>
                      </div>
                      <div className="dialog-actions landing-error-actions">
                        <button className="btn" autoFocus onClick={() => setPayError(false)}>
                          OK
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Win>
            <div className="landing-pricing-why">
              <h3>Why is it free?</h3>
              <p>
                Vibe95 runs on free AI models from OpenRouter, so a build costs nothing. We do not
                need your card, and we do not want it.
              </p>
              <p>
                Free models can be slow at busy times, and each account gets 100 builds a day.
                That is the catch.
              </p>
            </div>
          </div>
        </section>

        <section className="landing-section" id="help">
          <h2 className="landing-h2">Help</h2>
          <Win title="Vibe95 Help" icon={<FlagIcon size={14} />}>
            <div className="well landing-faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </Win>
        </section>

        <section className="landing-section landing-end">
          <div className="landing-logo" aria-hidden>
            Vibe95
          </div>
          <p className="landing-end-text">Click Start to begin.</p>
          <a className="btn landing-btn-link landing-btn-big" href="#new-user">
            <FlagIcon size={16} />
            Start
          </a>
          <p className="landing-note">No credit card. We would not know what to do with one.</p>
        </section>

        <footer className="landing-footer">
          Vibe95 (C) 1995 Landing Systems. Not affiliated with Microsoft.
        </footer>
      </main>

      {startOpen && <StartMenu onClose={() => setStartOpen(false)} />}
      <div className="taskbar">
        <button
          className={`btn start-btn${startOpen ? ' open' : ''}`}
          aria-expanded={startOpen}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setStartOpen((o) => !o)}
        >
          <FlagIcon size={16} />
          Start
        </button>
        <span className="landing-taskbar-hint">&#9664; Click here to begin.</span>
        <div className="taskbar-tray">
          <Clock />
        </div>
      </div>
    </div>
  )
}
