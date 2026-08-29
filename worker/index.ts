import { Hono } from 'hono'
import { getMigrations } from 'better-auth/db/migration'
import type { BetterAuthOptions } from 'better-auth'
import { getAuth, type Env } from './auth'

export { GenerationJob } from './generator'
export { VibeRoom } from './chat'

const DAILY_GENERATION_LIMIT = 100

const app = new Hono<{ Bindings: Env }>()

/* ---- auth ----------------------------------------------------------- */

app.on(['POST', 'GET'], '/api/auth/*', (c) => getAuth(c.env).handler(c.req.raw))

async function requireUser(c: { env: Env; req: { raw: Request } }) {
  const auth = getAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  return session?.user ?? null
}

/* ---- one-time setup: creates Better Auth tables + app tables -------- */

app.post('/api/migrate', async (c) => {
  const token = c.req.header('x-migrate-token')
  const isLocal = new URL(c.req.url).hostname === 'localhost'
  if (!isLocal && (!c.env.MIGRATE_TOKEN || token !== c.env.MIGRATE_TOKEN)) {
    return c.json({ error: 'forbidden' }, 403)
  }
  const auth = getAuth(c.env)
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(
    auth.options as unknown as BetterAuthOptions
  )
  if (toBeCreated.length || toBeAdded.length) await runMigrations()
  await c.env.DB.batch([
    c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS programs (
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        html TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, name)
      )`
    ),
    c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS chat_rooms (
        name TEXT PRIMARY KEY,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`
    ),
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO chat_rooms (name, created_by, created_at) VALUES ('lobby', 'system', 0)`
    ),
    c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS shared_programs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        name TEXT NOT NULL,
        html TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`
    ),
    c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS folders (
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, name)
      )`
    ),
    c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS usage_daily (
        user_id TEXT NOT NULL,
        day TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, day)
      )`
    ),
  ])
  // Column additions for older databases; D1 has no IF NOT EXISTS for columns.
  for (const sql of [
    'ALTER TABLE programs ADD COLUMN icon TEXT',
    'ALTER TABLE shared_programs ADD COLUMN icon TEXT',
    // Source files of multi-file programs (JSON path->content); html stays
    // the assembled, runnable artifact that shares and downloads use.
    'ALTER TABLE programs ADD COLUMN files TEXT',
    // Desktop folder a program lives in (null = the desktop itself).
    'ALTER TABLE programs ADD COLUMN folder TEXT',
  ]) {
    await c.env.DB.prepare(sql).run().catch(() => {})
  }
  return c.json({ ok: true, created: toBeCreated.map((t) => t.table) })
})

const ICON_RE = /^[0-9A-F.]{256}$/
const FILE_PATH_RE = /^[A-Za-z0-9_\-]{1,32}\.(html|css|js|json|txt|svg)$/
const MAX_FILES = 24

/** Validate and serialize a program's source-file map, or null if unusable. */
function packFiles(files: unknown): string | null {
  if (!files || typeof files !== 'object' || Array.isArray(files)) return null
  const entries = Object.entries(files as Record<string, unknown>)
  if (!entries.length || entries.length > MAX_FILES) return null
  let total = 0
  for (const [path, content] of entries) {
    if (!FILE_PATH_RE.test(path) || typeof content !== 'string') return null
    total += content.length
  }
  if (total > 400_000) return null
  return JSON.stringify(files)
}

/* ---- generation (auth + daily limit) -------------------------------- */

// The platform runs on one fixed free model; client model choice is ignored.
const MODEL = 'minimax/minimax-m3:free'

// Conversation caps for /api/generate (studio turns: system prompt + a few
// complete 400KB-max program responses fit comfortably).
const MAX_GEN_MESSAGES = 60
const MAX_GEN_CHARS = 2_000_000

app.post('/api/generate', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'You must log on first.' }, 401)

  if (!c.env.OPENROUTER_API_KEY) {
    return c.json({ error: 'Server is missing OPENROUTER_API_KEY.' }, 500)
  }

  // Validate the conversation BEFORE spending quota: bad requests must not
  // consume generations, and the platform key must not be an open proxy for
  // arbitrary payloads. The caps are generous for real studio conversations
  // (system prompt + a few full program responses) but bound per-request cost.
  const { messages } = await c.req.json<{
    messages: { role: string; content: string }[]
  }>()
  if (
    !Array.isArray(messages) ||
    !messages.length ||
    messages.length > MAX_GEN_MESSAGES ||
    !messages.every(
      (m) =>
        m &&
        (m.role === 'system' || m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
    ) ||
    messages.reduce((n, m) => n + m.content.length, 0) > MAX_GEN_CHARS
  ) {
    return c.json({ error: 'messages are missing, malformed, or too large' }, 400)
  }

  const day = new Date().toISOString().slice(0, 10)
  const usage = await c.env.DB.prepare(
    `INSERT INTO usage_daily (user_id, day, count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1
     RETURNING count`
  )
    .bind(user.id, day)
    .first<{ count: number }>()
  if ((usage?.count ?? 0) > DAILY_GENERATION_LIMIT) {
    return c.json(
      { error: `Daily limit reached (${DAILY_GENERATION_LIMIT} generations). Try again tomorrow.` },
      429
    )
  }

  // Each generation runs in its own Durable Object so it survives client
  // disconnects; the client attaches to /api/generate/:jobId/stream.
  const jobId = crypto.randomUUID()
  const stub = c.env.GENERATOR.getByName(jobId)
  const started = await stub.start(user.id, MODEL, messages)
  if (!started.ok) {
    return c.json({ error: started.error ?? 'Could not start generation.' }, 500)
  }
  return c.json({ jobId })
})

app.get('/api/generate/:jobId/stream', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  const jobId = c.req.param('jobId')
  if (!/^[0-9a-f-]{36}$/.test(jobId)) return c.json({ error: 'bad job id' }, 400)
  const stub = c.env.GENERATOR.getByName(jobId)
  const meta = await stub.getMeta()
  if (!meta.userId) return c.json({ error: 'job not found' }, 404)
  if (meta.userId !== user.id) return c.json({ error: 'forbidden' }, 403)
  const from = c.req.query('from') ?? '0'
  return stub.fetch(new Request(`https://do/stream?from=${encodeURIComponent(from)}`))
})

/* ---- programs (per-user cloud storage) ------------------------------ */

app.get('/api/programs', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  const [rows, folderRows] = await Promise.all([
    c.env.DB.prepare(
      'SELECT name, html, icon, files, folder, created_at FROM programs WHERE user_id = ? ORDER BY created_at'
    )
      .bind(user.id)
      .all<{
        name: string
        html: string
        icon: string | null
        files: string | null
        folder: string | null
        created_at: number
      }>(),
    c.env.DB.prepare('SELECT name FROM folders WHERE user_id = ? ORDER BY created_at')
      .bind(user.id)
      .all<{ name: string }>(),
  ])
  return c.json({
    programs: rows.results.map((r) => {
      let files: Record<string, string> | null = null
      try {
        files = r.files ? (JSON.parse(r.files) as Record<string, string>) : null
      } catch {
        /* legacy or corrupt; the html artifact still runs */
      }
      return {
        name: r.name,
        html: r.html,
        icon: r.icon,
        files,
        folder: r.folder,
        createdAt: r.created_at,
      }
    }),
    folders: folderRows.results.map((r) => r.name),
  })
})

app.put('/api/programs/:name', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  const name = c.req.param('name')
  if (!/^[A-Z0-9_\-]{1,16}\.EXE$/.test(name)) {
    return c.json({ error: 'invalid file name' }, 400)
  }
  const { html, icon, files } = await c.req.json<{
    html: string
    icon?: string
    files?: Record<string, string>
  }>()
  if (typeof html !== 'string' || html.length > 400_000) {
    return c.json({ error: 'invalid or oversized program' }, 400)
  }
  const safeIcon = typeof icon === 'string' && ICON_RE.test(icon) ? icon : null
  const packed = files !== undefined ? packFiles(files) : null
  if (files !== undefined && packed === null) {
    return c.json({ error: 'invalid or oversized source files' }, 400)
  }
  const now = Date.now()
  await c.env.DB.prepare(
    // Like icon, an omitted files map keeps whatever is already stored; only
    // an explicit (validated) map replaces it.
    `INSERT INTO programs (user_id, name, html, icon, files, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, name) DO UPDATE SET
       html = excluded.html,
       icon = COALESCE(excluded.icon, programs.icon),
       files = COALESCE(excluded.files, programs.files),
       updated_at = excluded.updated_at`
  )
    .bind(user.id, name, html, safeIcon, packed, now, now)
    .run()
  return c.json({ ok: true, name })
})

app.delete('/api/programs/:name', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  await c.env.DB.prepare('DELETE FROM programs WHERE user_id = ? AND name = ?')
    .bind(user.id, c.req.param('name'))
    .run()
  return c.json({ ok: true })
})

const EXE_NAME_RE = /^[A-Z0-9_\-]{1,16}\.EXE$/
const FOLDER_NAME_RE = /^[A-Za-z0-9_\-][A-Za-z0-9 _\-]{0,19}$/

app.post('/api/programs/:name/rename', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  const from = c.req.param('name')
  const { to } = await c.req.json<{ to: string }>()
  if (typeof to !== 'string' || !EXE_NAME_RE.test(to)) {
    return c.json({ error: 'invalid file name' }, 400)
  }
  if (to !== from) {
    const clash = await c.env.DB.prepare(
      'SELECT name FROM programs WHERE user_id = ? AND name = ?'
    )
      .bind(user.id, to)
      .first()
    if (clash) return c.json({ error: 'a program with that name already exists' }, 409)
    await c.env.DB.prepare('UPDATE programs SET name = ?, updated_at = ? WHERE user_id = ? AND name = ?')
      .bind(to, Date.now(), user.id, from)
      .run()
  }
  return c.json({ ok: true, name: to })
})

app.post('/api/programs/:name/move', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  const { folder } = await c.req.json<{ folder: string | null }>()
  if (folder !== null) {
    if (typeof folder !== 'string' || !FOLDER_NAME_RE.test(folder)) {
      return c.json({ error: 'invalid folder' }, 400)
    }
    const exists = await c.env.DB.prepare('SELECT name FROM folders WHERE user_id = ? AND name = ?')
      .bind(user.id, folder)
      .first()
    if (!exists) return c.json({ error: 'no such folder' }, 404)
  }
  await c.env.DB.prepare('UPDATE programs SET folder = ? WHERE user_id = ? AND name = ?')
    .bind(folder, user.id, c.req.param('name'))
    .run()
  return c.json({ ok: true })
})

/* ---- desktop folders ------------------------------------------------- */

app.post('/api/folders', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  const { name } = await c.req.json<{ name: string }>()
  if (typeof name !== 'string' || !FOLDER_NAME_RE.test(name)) {
    return c.json({ error: 'invalid folder name' }, 400)
  }
  const clash = await c.env.DB.prepare('SELECT name FROM folders WHERE user_id = ? AND name = ?')
    .bind(user.id, name)
    .first()
  if (clash) return c.json({ error: 'a folder with that name already exists' }, 409)
  await c.env.DB.prepare('INSERT INTO folders (user_id, name, created_at) VALUES (?, ?, ?)')
    .bind(user.id, name, Date.now())
    .run()
  return c.json({ ok: true, name })
})

app.post('/api/folders/:name/rename', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  const from = c.req.param('name')
  const { to } = await c.req.json<{ to: string }>()
  if (typeof to !== 'string' || !FOLDER_NAME_RE.test(to)) {
    return c.json({ error: 'invalid folder name' }, 400)
  }
  if (to !== from) {
    const clash = await c.env.DB.prepare('SELECT name FROM folders WHERE user_id = ? AND name = ?')
      .bind(user.id, to)
      .first()
    if (clash) return c.json({ error: 'a folder with that name already exists' }, 409)
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE folders SET name = ? WHERE user_id = ? AND name = ?').bind(
        to,
        user.id,
        from
      ),
      c.env.DB.prepare('UPDATE programs SET folder = ? WHERE user_id = ? AND folder = ?').bind(
        to,
        user.id,
        from
      ),
    ])
  }
  return c.json({ ok: true, name: to })
})

app.delete('/api/folders/:name', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  const name = c.req.param('name')
  // Deleting a folder puts its contents back on the desktop.
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE programs SET folder = NULL WHERE user_id = ? AND folder = ?').bind(
      user.id,
      name
    ),
    c.env.DB.prepare('DELETE FROM folders WHERE user_id = ? AND name = ?').bind(user.id, name),
  ])
  return c.json({ ok: true })
})

/* ---- Vibe Room (global chat + program sharing) ---------------------- */

function displayName(user: { name?: string | null; email: string } & Record<string, unknown>) {
  const username = typeof user.username === 'string' ? user.username : null
  return username || user.name || user.email.split('@')[0]
}

const ROOM_NAME_RE = /^[a-z0-9][a-z0-9_\-]{0,19}$/
const MAX_ROOMS = 200

async function roomExists(env: Env, name: string) {
  if (!ROOM_NAME_RE.test(name)) return false
  const row = await env.DB.prepare('SELECT name FROM chat_rooms WHERE name = ?')
    .bind(name)
    .first()
  return row !== null
}

app.get('/api/chat/rooms', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  const rows = await c.env.DB.prepare(
    // The lobby always sorts first; the rest oldest-first.
    `SELECT name FROM chat_rooms ORDER BY created_at, name`
  ).all<{ name: string }>()
  return c.json({ rooms: rows.results.map((r) => r.name) })
})

app.post('/api/chat/rooms', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  const body = await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string })
  const name = (body.name ?? '').trim().toLowerCase().replace(/^#/, '')
  if (!ROOM_NAME_RE.test(name)) {
    return c.json({ error: 'Room names: 1-20 letters, numbers, - or _' }, 400)
  }
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM chat_rooms').first<{ n: number }>()
  if ((count?.n ?? 0) >= MAX_ROOMS) return c.json({ error: 'Too many rooms already exist.' }, 400)
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO chat_rooms (name, created_by, created_at) VALUES (?, ?, ?)'
  )
    .bind(name, user.id, Date.now())
    .run()
  return c.json({ ok: true, name })
})

app.get('/api/chat/ws', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'expected websocket' }, 426)
  }
  const room = c.req.query('room') ?? 'lobby'
  if (!(await roomExists(c.env, room))) return c.json({ error: 'room not found' }, 404)
  const stub = c.env.CHAT.getByName(room)
  const headers = new Headers(c.req.raw.headers)
  headers.set('x-user-id', user.id)
  headers.set('x-user-name', displayName(user))
  return stub.fetch(new Request(c.req.raw.url, { headers }))
})

// Share one of your programs to the room. Snapshots the HTML so later edits
// (or deletes) never change what other users downloaded or previewed.
app.post('/api/chat/share/:name', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  const room = c.req.query('room') ?? 'lobby'
  if (!(await roomExists(c.env, room))) return c.json({ error: 'room not found' }, 404)
  const name = c.req.param('name')
  const program = await c.env.DB.prepare(
    'SELECT html, icon FROM programs WHERE user_id = ? AND name = ?'
  )
    .bind(user.id, name)
    .first<{ html: string; icon: string | null }>()
  if (!program) return c.json({ error: 'program not found' }, 404)

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO shared_programs (id, user_id, username, name, html, icon, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, user.id, displayName(user), name, program.html, program.icon, Date.now())
    .run()
  await c.env.CHAT.getByName(room).postShare(
    { id: user.id, name: displayName(user) },
    { shareId: id, name }
  )
  return c.json({ ok: true, shareId: id })
})

// Fetch a shared program's HTML (used by the Run button to try before saving).
app.get('/api/chat/share/:id', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  const share = await c.env.DB.prepare(
    'SELECT name, html FROM shared_programs WHERE id = ?'
  )
    .bind(c.req.param('id'))
    .first<{ name: string; html: string }>()
  if (!share) return c.json({ error: 'share not found' }, 404)
  return c.json(share)
})

// Copy a shared program onto your own desktop, deduping the file name.
app.post('/api/chat/share/:id/download', async (c) => {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  const share = await c.env.DB.prepare(
    'SELECT name, html, icon FROM shared_programs WHERE id = ?'
  )
    .bind(c.req.param('id'))
    .first<{ name: string; html: string; icon: string | null }>()
  if (!share) return c.json({ error: 'share not found' }, 404)

  const taken = new Set(
    (
      await c.env.DB.prepare('SELECT name FROM programs WHERE user_id = ?')
        .bind(user.id)
        .all<{ name: string }>()
    ).results.map((r) => r.name)
  )
  const base = share.name.replace(/\.EXE$/, '')
  let name = share.name
  for (let i = 2; taken.has(name) && i < 100; i++) {
    name = `${base.slice(0, 16 - String(i).length)}${i}.EXE`
  }
  const now = Date.now()
  await c.env.DB.prepare(
    // Shares carry no source files; clear any stale files column so an
    // overwritten slot doesn't keep sources from an unrelated program.
    `INSERT INTO programs (user_id, name, html, icon, files, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)
     ON CONFLICT(user_id, name) DO UPDATE SET
       html = excluded.html,
       icon = excluded.icon,
       files = NULL,
       updated_at = excluded.updated_at`
  )
    .bind(user.id, name, share.html, share.icon, now, now)
    .run()
  return c.json({ name, html: share.html, icon: share.icon, createdAt: now })
})

export default app
