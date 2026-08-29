/**
 * The Vibe Studio generation protocol: the model writes a program as a set of
 * named files (plus name/icon/note headers) using line delimiters instead of
 * one giant fenced block. Free models truncate long single completions and
 * drift from fenced-block contracts; small named sections parse reliably,
 * fail per-file instead of per-program, and give the server a hard
 * end-of-response marker (=== END ===) to detect truncation.
 *
 * Full builds emit FILE sections; change requests may emit EDIT sections
 * containing SEARCH/REPLACE blocks (so a one-line fix doesn't re-send 25KB)
 * and DELETE sections to remove a file.
 *
 * NOTE: worker/generator.ts duplicates END_MARKER and the section regex (the
 * worker build does not import from src/). Keep them in sync.
 */

export const END_MARKER = '=== END ==='

export const MAX_FILES = 24
export const MAX_TOTAL_BYTES = 400_000
/** Per-file JS budget. MiniMax produces unfixable syntax errors past this. */
export const MAX_JS_FILE_CHARS = 8_000
export const FILE_PATH_RE = /^[A-Za-z0-9_\-]{1,32}\.(html|css|js|json|txt|svg)$/

export const SECTION_RE = /^[ \t]*={2,5}\s*(FILE|EDIT|DELETE)\s*:\s*([^\s=]+)\s*={2,5}[ \t]*$/
export const END_RE = /^[ \t]*={2,5}\s*END\s*={2,5}[ \t]*$/
const ICON_CHARS_RE = /^[0-9A-Fa-f.]+$/

export interface ParsedSection {
  kind: 'file' | 'edit' | 'delete'
  path: string
  body: string
}

export interface ProgramSize {
  w: number
  h: number
}

export interface ParsedResponse {
  name: string | null
  icon: string | null
  note: string | null
  /** Client-area size the program is designed for (SIZE: 480x360). */
  size: ProgramSize | null
  sections: ParsedSection[]
  /** true when the terminal END marker was seen (i.e. not truncated) */
  complete: boolean
}

export const MIN_SIZE: ProgramSize = { w: 240, h: 160 }
export const MAX_SIZE: ProgramSize = { w: 960, h: 640 }

function clampSize(w: number, h: number): ProgramSize {
  return {
    w: Math.max(MIN_SIZE.w, Math.min(MAX_SIZE.w, Math.round(w))),
    h: Math.max(MIN_SIZE.h, Math.min(MAX_SIZE.h, Math.round(h))),
  }
}

function parseSize(value: string): ProgramSize | null {
  const m = value.match(/^(\d{2,4})\s*[xX]\s*(\d{2,4})$/)
  return m ? clampSize(Number(m[1]), Number(m[2])) : null
}

/** Normalize one row of icon art to exactly 16 pixels. */
function padIconRow(row: string): string {
  return (row.trim().toUpperCase() + '................').slice(0, 16)
}

/**
 * Parse a model response into headers and sections. Tolerant by design:
 * marker rows may use 2-5 equals signs, file bodies may be wrapped in a
 * stray markdown fence, and the icon may be one 256-char line or up to 16
 * rows of pixel art under the ICON: header.
 */
export function parseProtocol(text: string): ParsedResponse {
  let name: string | null = null
  let icon: string | null = null
  let note: string | null = null
  let size: ProgramSize | null = null
  const iconRows: string[] = []
  let inIcon = false
  const sections: ParsedSection[] = []
  let complete = false

  let current: ParsedSection | null = null
  let body: string[] = []
  const flush = () => {
    if (!current) return
    let content = body.join('\n')
    // Strip a stray markdown fence wrapping the whole section body.
    content = content.replace(/^\s*```[a-z]*\n/i, '').replace(/\n```\s*$/i, '')
    current.body = content.replace(/^\n+/, '').replace(/\s+$/, '')
    sections.push(current)
    current = null
    body = []
  }

  for (const line of text.split('\n')) {
    const sec = line.match(SECTION_RE)
    if (sec) {
      inIcon = false
      flush()
      current = { kind: sec[1].toLowerCase() as ParsedSection['kind'], path: sec[2].trim(), body: '' }
      continue
    }
    if (END_RE.test(line)) {
      flush()
      complete = true
      break
    }
    if (current) {
      body.push(line)
      continue
    }

    // Header zone: everything before the first section marker.
    const trimmed = line.trim()
    if (inIcon) {
      if (trimmed && ICON_CHARS_RE.test(trimmed) && iconRows.length < 16) {
        iconRows.push(padIconRow(trimmed))
        continue
      }
      inIcon = false
    }
    const header = trimmed.match(/^(NAME|ICON|NOTE|SIZE)\s*:\s*(.*)$/)
    if (!header) continue
    const value = header[2].trim()
    if (header[1] === 'NAME') {
      name = value.toUpperCase().replace(/[^A-Z0-9_\-]/g, '').slice(0, 12) || null
    } else if (header[1] === 'NOTE') {
      note = value.slice(0, 500) || null
    } else if (header[1] === 'SIZE') {
      size = parseSize(value) ?? size
    } else if (!icon && !iconRows.length) {
      if (value && ICON_CHARS_RE.test(value) && value.length >= 200) {
        icon = (value.toUpperCase() + '.'.repeat(256)).slice(0, 256)
      } else {
        if (value && ICON_CHARS_RE.test(value)) iconRows.push(padIconRow(value))
        inIcon = true
      }
    }
  }
  flush()

  if (!icon && iconRows.length >= 8) {
    while (iconRows.length < 16) iconRows.push('................')
    icon = iconRows.join('')
  }
  return { name, icon, note, size, sections, complete }
}

const HEADER_LINE_RE = /^(NAME|ICON|NOTE|SIZE)\s*:/

/**
 * The protocol portion of a (possibly chatty) response: from the first
 * header or section line through the END marker. Everything outside that
 * span is model commentary and must never reach the code view.
 */
export function protocolText(text: string): string {
  const lines = text.split('\n')
  const start = lines.findIndex(
    (l) => SECTION_RE.test(l) || HEADER_LINE_RE.test(l.trim())
  )
  if (start === -1) return ''
  const end = lines.findIndex((l) => END_RE.test(l))
  return lines.slice(start, end === -1 ? undefined : end + 1).join('\n')
}

/** Model chatter outside the protocol span (before the headers / after END). */
export function strayProse(text: string): string {
  const lines = text.split('\n')
  const start = lines.findIndex(
    (l) => SECTION_RE.test(l) || HEADER_LINE_RE.test(l.trim())
  )
  const end = lines.findIndex((l) => END_RE.test(l))
  const before = start === -1 ? lines : lines.slice(0, start)
  const after = end === -1 ? [] : lines.slice(end + 1)
  return [...before, ...after].join('\n').trim()
}

/* ===== Applying a response to a program's file set ==================== */

export interface ApplyResult {
  files: Record<string, string>
  /** Problems the model must fix (fed back as a repair turn). */
  issues: string[]
}

// The replace side may be EMPTY (a pure deletion): the group runs to the
// >>>>>>> marker itself, and applyResponse strips the one newline that
// belongs to the marker line rather than the replacement text.
const SEARCH_REPLACE_RE = /<{4,9}[ \t]*SEARCH[ \t]*\n([\s\S]*?)\n={4,9}[ \t]*\n([\s\S]*?)>{4,9}[ \t]*REPLACE/g

function spanFromLines(
  contentLines: string[],
  startLine: number,
  n: number
): { start: number; end: number } {
  const start = contentLines.slice(0, startLine).join('\n').length + (startLine > 0 ? 1 : 0)
  const matched = contentLines.slice(startLine, startLine + n).join('\n')
  return { start, end: start + matched.length }
}

/**
 * Exact match first, then line-wise: trailing whitespace, then leading
 * indent. MiniMax often pastes SEARCH with an extra indent on the first
 * line (or every line) of a copied block.
 */
function findSpan(content: string, search: string): { start: number; end: number } | null {
  const exact = content.indexOf(search)
  if (exact !== -1) return { start: exact, end: exact + search.length }

  const contentLines = content.split('\n')
  const searchLines = search.replace(/\r/g, '').split('\n')

  const match = (fold: (s: string) => string) => {
    const want = searchLines.map(fold)
    for (let i = 0; i + want.length <= contentLines.length; i++) {
      let ok = true
      for (let j = 0; j < want.length; j++) {
        if (fold(contentLines[i + j]) !== want[j]) {
          ok = false
          break
        }
      }
      if (ok) return spanFromLines(contentLines, i, want.length)
    }
    return null
  }

  return (
    match((s) => s.replace(/[ \t]+$/g, '')) ||
    match((s) => s.replace(/^[ \t]+/, '').replace(/[ \t]+$/g, ''))
  )
}

/** Apply a parsed response to the current files, collecting model-fixable issues. */
export function applyResponse(
  base: Record<string, string>,
  parsed: ParsedResponse
): ApplyResult {
  const files = { ...base }
  const issues: string[] = []

  for (const sec of parsed.sections) {
    if (!FILE_PATH_RE.test(sec.path)) {
      issues.push(
        `Invalid file name "${sec.path}". Use simple names like index.html, style.css, app.js.`
      )
      continue
    }
    if (sec.kind === 'delete') {
      delete files[sec.path]
      continue
    }
    if (sec.kind === 'file') {
      if (!sec.body) {
        issues.push(`FILE section for ${sec.path} was empty. Output its complete content.`)
        continue
      }
      files[sec.path] = sec.body
      continue
    }
    // EDIT: one or more SEARCH/REPLACE blocks against the existing file.
    const target = files[sec.path]
    if (target === undefined) {
      issues.push(`EDIT section for ${sec.path}, but that file does not exist. Use FILE to create it.`)
      continue
    }
    let updated = target
    let blocks = 0
    for (const m of sec.body.matchAll(SEARCH_REPLACE_RE)) {
      blocks++
      const span = findSpan(updated, m[1])
      if (!span) {
        issues.push(
          `In ${sec.path}, this SEARCH text was not found. Copy SEARCH from the current file in the previous assistant message (exact characters). If that still cannot match, rewrite only ${sec.path} with a FILE section.\n${m[1].slice(0, 300)}`
        )
        continue
      }
      const replacement = m[2].replace(/\n$/, '') // the newline before >>>>>>> is the marker's
      updated = updated.slice(0, span.start) + replacement + updated.slice(span.end)
    }
    if (!blocks) {
      issues.push(
        `EDIT section for ${sec.path} contained no SEARCH/REPLACE blocks. Use <<<<<<< SEARCH / ======= / >>>>>>> REPLACE.`
      )
      continue
    }
    files[sec.path] = updated
  }

  if (Object.keys(files).length > MAX_FILES) {
    issues.push(`Too many files (max ${MAX_FILES}). Consolidate.`)
  }
  const total = Object.values(files).reduce((n, c) => n + c.length, 0)
  if (total > MAX_TOTAL_BYTES) {
    issues.push('The program is too large. Reduce it below 400,000 characters total.')
  }
  return { files, issues }
}

/* ===== Assembling files into the single runnable HTML doc ============= */

/** Local paths referenced by index.html that no FILE provides. */
export function missingReferences(files: Record<string, string>): string[] {
  const html = files['index.html'] ?? ''
  const missing = new Set<string>()
  for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([A-Za-z0-9_\-]+\.[a-z]+)["']/gi)) {
    if (!(m[1] in files)) missing.add(m[1])
  }
  return [...missing]
}

/**
 * Build the single self-contained HTML document that actually runs: js and
 * css files are inlined where index.html references them. The assembled doc
 * is what gets saved, verified, shared, and executed, so everything
 * downstream of the studio still deals in one HTML string.
 */
export function assembleProgram(files: Record<string, string>, size?: ProgramSize | null): string {
  let html = files['index.html'] ?? Object.values(files)[0] ?? ''
  html = html.replace(
    /<script([^>]*?)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (whole, pre, src, post) => {
      const body = files[src]
      if (body === undefined) return whole
      // "</script" inside the inlined code would end the tag early; the
      // escaped form is equivalent inside JS strings and regexes.
      return `<script${pre}${post}>\n${body.replace(/<\/script/gi, '<\\/script')}\n</script>`
    }
  )
  html = html.replace(/<link\b[^>]*>/gi, (whole) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(whole)) return whole
    const href = whole.match(/href\s*=\s*["']([^"']+)["']/i)?.[1]
    const body = href ? files[href] : undefined
    if (body === undefined) return whole
    return `<style>\n${body}\n</style>`
  })
  // Stamp the designed client-area size into the artifact so anything that
  // opens it later (desktop, shares, downloads) can size the window to fit.
  if (size) {
    const meta = `<meta name="vibe-size" content="${size.w}x${size.h}">`
    if (/<meta\s+name=["']vibe-size["']/i.test(html)) {
      html = html.replace(/<meta\s+name=["']vibe-size["'][^>]*>/i, meta)
    } else {
      const head = html.match(/<head[^>]*>/i)
      if (head && head.index !== undefined) {
        const at = head.index + head[0].length
        html = html.slice(0, at) + meta + html.slice(at)
      } else {
        html = meta + html
      }
    }
  }
  return html
}

/** Read the designed client-area size back out of an assembled program. */
export function extractSize(html: string): ProgramSize | null {
  const m = html.match(/<meta\s+name=["']vibe-size["']\s+content=["'](\d{2,4})x(\d{2,4})["']/i)
  return m ? clampSize(Number(m[1]), Number(m[2])) : null
}

/** Render a file set back into protocol text (seeds edit-mode history). */
export function renderProtocol(
  files: Record<string, string>,
  headers?: {
    name?: string | null
    icon?: string | null
    note?: string | null
    size?: ProgramSize | null
  }
): string {
  const parts: string[] = []
  if (headers?.name) parts.push(`NAME: ${headers.name}`)
  if (headers?.size) parts.push(`SIZE: ${headers.size.w}x${headers.size.h}`)
  if (headers?.icon) {
    parts.push('ICON: ' + headers.icon.slice(0, 16))
    for (let i = 1; i < 16; i++) parts.push(headers.icon.slice(i * 16, i * 16 + 16))
  }
  if (headers?.note) parts.push(`NOTE: ${headers.note}`)
  for (const [path, content] of Object.entries(files)) {
    parts.push(`=== FILE: ${path} ===`, content)
  }
  parts.push(END_MARKER)
  return parts.join('\n')
}
