import { buildRunnerDoc } from './runtime'

const RUNTIME_TEST_MS = 2000

/** Syntax-check every classic inline <script> without executing it. */
function checkScriptSyntax(html: string): string[] {
  const issues: string[] = []
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1]
    const body = m[2]
    if (/\bsrc\s*=/i.test(attrs)) {
      issues.push('A <script src=...> external script was found. Programs must be fully self-contained.')
      continue
    }
    if (/\btype\s*=/i.test(attrs) && !/javascript/i.test(attrs)) continue
    if (!body.trim()) continue
    try {
      // eslint-disable-next-line no-new-func
      new Function(body)
    } catch (e) {
      issues.push(`Script syntax error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
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
 * Lightweight verification of a generated program: structure, script syntax,
 * then a real render in a hidden sandbox watching for runtime errors.
 */
export async function verifyProgram(html: string): Promise<string[]> {
  const staticIssues = [...checkStructure(html), ...checkScriptSyntax(html)]
  // A syntax error guarantees runtime noise about the same problem — skip the run.
  if (staticIssues.some((i) => i.startsWith('Script syntax error'))) return staticIssues
  const runtime = await runInHiddenFrame(html)
  return [...staticIssues, ...runtime]
}
