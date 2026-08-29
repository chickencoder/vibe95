import * as acorn from 'acorn'
import type { Node, Program } from 'acorn'
import { buildRunnerDoc } from './runtime'
import { MAX_JS_FILE_CHARS } from './protocol'

const RUNTIME_TEST_MS = 2000

const ACORN_OPTS = { ecmaVersion: 'latest' as const, sourceType: 'script' as const, locations: true }

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split('\n').length
}

function snippet(code: string, line: number, radius = 2): string {
  const lines = code.split('\n')
  const from = Math.max(1, line - radius)
  const to = Math.min(lines.length, line + radius)
  const width = String(to).length
  const out: string[] = []
  for (let i = from; i <= to; i++) {
    const mark = i === line ? '>>>' : '   '
    out.push(`${mark} ${String(i).padStart(width)}| ${lines[i - 1] ?? ''}`)
  }
  return out.join('\n')
}

function acornMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  // Acorn appends " (line:col)" — we print our own location.
  return raw.replace(/\s*\(\d+:\d+\)$/, '')
}

function acornLine(e: unknown, fallback = 1): number {
  if (e && typeof e === 'object' && 'loc' in e) {
    const loc = (e as { loc?: { line?: number } }).loc
    if (loc && typeof loc.line === 'number') return loc.line
  }
  return fallback
}

/**
 * Window properties that already occupy the global scope of a classic
 * <script>. Top-level let/const/var/class/function of these names throw
 * "Identifier 'history' has already been declared" in the iframe — Acorn
 * alone accepts them because it isn't a browser.
 */
const WINDOW_GLOBALS = new Set([
  'history',
  'name',
  'status',
  'location',
  'navigator',
  'screen',
  'event',
  'top',
  'parent',
  'self',
  'frames',
  'length',
  'closed',
  'opener',
  'origin',
  'localStorage',
  'sessionStorage',
  'document',
  'window',
  'performance',
  'crypto',
  'menubar',
  'toolbar',
  'locationbar',
  'personalbar',
  'scrollbars',
  'external',
  'alert',
  'confirm',
  'prompt',
  'close',
  'open',
  'focus',
  'blur',
  'print', // let/const print; function print() is also a Window method — still crashes as let/const
  'innerWidth',
  'innerHeight',
  'outerWidth',
  'outerHeight',
  'scrollX',
  'scrollY',
  'pageXOffset',
  'pageYOffset',
])

/** function print() overwrites window.print and is fine; function history() is not. */
const FUNCTION_BLOCKED = new Set([
  'history',
  'name',
  'status',
  'location',
  'navigator',
  'screen',
  'event',
  'top',
  'parent',
  'self',
  'frames',
  'length',
  'document',
  'window',
  'localStorage',
  'sessionStorage',
])

type Bound = { name: string; line: number }

function collectBoundIds(node: Node | null | undefined, fallbackLine: number, out: Bound[]) {
  if (!node) return
  const n = node as Node & {
    type: string
    name?: string
    loc?: { start: { line: number } }
    properties?: Node[]
    elements?: (Node | null)[]
    argument?: Node
    left?: Node
    value?: Node
    id?: Node
  }
  const line = n.loc?.start.line ?? fallbackLine
  if (n.type === 'Identifier' && n.name) {
    out.push({ name: n.name, line })
    return
  }
  if (n.type === 'ObjectPattern') {
    for (const p of n.properties ?? []) {
      const prop = p as Node & { type: string; value?: Node; argument?: Node }
      if (prop.type === 'RestElement') collectBoundIds(prop.argument, line, out)
      else collectBoundIds(prop.value, line, out)
    }
    return
  }
  if (n.type === 'ArrayPattern') {
    for (const el of n.elements ?? []) {
      if (!el) continue
      const item = el as Node & { type: string; argument?: Node }
      collectBoundIds(item.type === 'RestElement' ? item.argument : el, line, out)
    }
    return
  }
  if (n.type === 'AssignmentPattern') collectBoundIds(n.left, line, out)
  if (n.type === 'RestElement') collectBoundIds(n.argument, line, out)
}

function topLevelBindings(ast: Program): { vars: Bound[]; fns: Bound[] } {
  const vars: Bound[] = []
  const fns: Bound[] = []
  for (const stmt of ast.body) {
    const s = stmt as Node & {
      type: string
      kind?: string
      declarations?: { id: Node; loc?: { start: { line: number } } }[]
      id?: { name?: string; loc?: { start: { line: number } } }
      loc?: { start: { line: number } }
    }
    const line = s.loc?.start.line ?? 1
    if (s.type === 'VariableDeclaration') {
      for (const d of s.declarations ?? []) {
        collectBoundIds(d.id, d.loc?.start.line ?? line, vars)
      }
    } else if (s.type === 'ClassDeclaration' && s.id?.name) {
      vars.push({ name: s.id.name, line: s.id.loc?.start.line ?? line })
    } else if (s.type === 'FunctionDeclaration' && s.id?.name) {
      fns.push({ name: s.id.name, line: s.id.loc?.start.line ?? line })
    }
  }
  return { vars, fns }
}

function windowBindingIssues(ast: Program): { line: number; message: string }[] {
  const { vars, fns } = topLevelBindings(ast)
  const issues: { line: number; message: string }[] = []
  const seen = new Set<string>()
  for (const b of vars) {
    if (!WINDOW_GLOBALS.has(b.name) || seen.has(b.name)) continue
    seen.add(b.name)
    issues.push({
      line: b.line,
      message:
        `"${b.name}" clashes with the browser's window.${b.name}. ` +
        `Rename this top-level let/const/var (e.g. cmdHistory, playerName).`,
    })
  }
  for (const b of fns) {
    if (!FUNCTION_BLOCKED.has(b.name) || seen.has(b.name)) continue
    seen.add(b.name)
    issues.push({
      line: b.line,
      message:
        `"${b.name}" clashes with the browser's window.${b.name}. ` +
        `Rename this top-level function.`,
    })
  }
  return issues
}

function scriptIssues(code: string): { line: number; message: string }[] {
  try {
    const ast = acorn.parse(code, ACORN_OPTS) as Program
    return windowBindingIssues(ast)
  } catch (e) {
    return [{ line: acornLine(e), message: acornMessage(e) }]
  }
}

/** Parse JS as a classic script; return the first issue (parse or window-global clash) or null. */
export function locateSyntaxError(code: string): { line: number; message: string } | null {
  return scriptIssues(code)[0] ?? null
}

function formatSyntaxIssue(path: string, code: string, message: string, line: number): string {
  return `Syntax error in ${path} line ${line}: ${message}\n${snippet(code, line)}`
}

/** Syntax-check a .js file, or every classic inline <script> in an HTML file. */
function checkFileSyntax(path: string, content: string): string[] {
  if (/\.js$/i.test(path)) {
    return scriptIssues(content).map((iss) => formatSyntaxIssue(path, content, iss.message, iss.line))
  }
  if (!/\.html$/i.test(path)) return []
  const issues: string[] = []
  for (const m of content.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1]
    const body = m[2]
    if (/\bsrc\s*=/i.test(attrs)) continue
    if (/\btype\s*=/i.test(attrs) && !/javascript/i.test(attrs)) continue
    if (!body.trim()) continue
    const bodyStart = (m.index ?? 0) + m[0].indexOf(body)
    const bodyLine0 = lineAt(content, bodyStart)
    for (const iss of scriptIssues(body)) {
      const htmlLine = bodyLine0 + iss.line - 1
      issues.push(formatSyntaxIssue(path, content, iss.message, htmlLine))
    }
  }
  return issues
}

function oversizedJs(files: Record<string, string>): string[] {
  const issues: string[] = []
  for (const [path, content] of Object.entries(files)) {
    if (!/\.js$/i.test(path) || content.length <= MAX_JS_FILE_CHARS) continue
    issues.push(
      `${path} is ${content.length} characters (limit ${MAX_JS_FILE_CHARS}). ` +
        `Split it into two or more JS files (e.g. data.js + app.js), keep each under ` +
        `${MAX_JS_FILE_CHARS} characters, and <script src> them from index.html. ` +
        `Large JS files come out with syntax errors.`
    )
  }
  return issues
}

/**
 * Static checks on the source files: JS size budget, then per-file syntax
 * with a line number and a source snippet the model can actually fix.
 */
export function checkProgramFiles(files: Record<string, string>): string[] {
  const issues: string[] = []
  for (const [path, content] of Object.entries(files)) {
    issues.push(...checkFileSyntax(path, content))
  }
  issues.push(...oversizedJs(files))
  return issues
}

function checkStructure(html: string): string[] {
  const issues: string[] = []
  if (!/<html[\s>]/i.test(html)) issues.push('Missing <html> element.')
  if (!/<body[\s>]/i.test(html)) issues.push('Missing <body> element.')
  const externals = html.match(/(href|src)\s*=\s*["']https?:\/\//gi)
  if (externals) {
    issues.push('The file references external URLs. Everything must be inline with no network access.')
  }
  return issues
}

/** Run the program in a hidden sandboxed iframe and collect runtime errors. */
function runInHiddenFrame(html: string): Promise<string[]> {
  return new Promise((resolve) => {
    const token = `t${Math.random().toString(36).slice(2)}`
    const errors: string[] = []
    const frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.style.cssText =
      'position:absolute;left:-4000px;top:0;width:640px;height:480px;visibility:hidden'
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { __vibe95?: string; message?: string } | null
      if (data && data.__vibe95 === token && data.message && errors.length < 5) {
        if (!errors.includes(data.message)) errors.push(data.message)
      }
    }
    window.addEventListener('message', onMessage)
    frame.srcdoc = buildRunnerDoc(html, token)
    document.body.appendChild(frame)
    setTimeout(() => {
      window.removeEventListener('message', onMessage)
      frame.remove()
      resolve(errors.map((m) => `Runtime error: ${m}`))
    }, RUNTIME_TEST_MS)
  })
}

/**
 * Verify the assembled program: structure, then a real render in a hidden
 * sandbox. Syntax is checked per source file via checkProgramFiles — doing
 * it again here would lose the path/line of the broken JS file.
 */
export async function verifyProgram(
  html: string,
  opts?: { skipRuntime?: boolean }
): Promise<string[]> {
  const staticIssues = checkStructure(html)
  if (opts?.skipRuntime) return staticIssues
  const runtime = await runInHiddenFrame(html)
  return [...staticIssues, ...runtime]
}
