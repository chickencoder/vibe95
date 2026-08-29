/**
 * Sandboxed iframes have an opaque origin, where touching window.localStorage
 * throws a SecurityError. Generated programs use it for save data, so shim it
 * with an in-memory implementation before any program code runs.
 */
/**
 * Focusing the iframe ELEMENT from the parent doesn't reliably move keyboard
 * focus into an opaque-origin (sandboxed) document. Let the program focus
 * itself: once on load, and again whenever the OS asks via postMessage.
 */
const FOCUS_SHIM = `<script>(function(){var f=function(){try{window.focus()}catch(e){}};window.addEventListener('load',f);window.addEventListener('message',function(e){if(e.data&&e.data.__vibe95Focus)f()})})()</script>`

const STORAGE_SHIM = `<script>(function(){try{window.localStorage.length}catch(e){var mk=function(){var s={};return{getItem:function(k){return k in s?s[k]:null},setItem:function(k,v){s[k]=String(v)},removeItem:function(k){delete s[k]},clear:function(){s={}},key:function(i){return Object.keys(s)[i]||null},get length(){return Object.keys(s).length}}};try{Object.defineProperty(window,'localStorage',{value:mk()});Object.defineProperty(window,'sessionStorage',{value:mk()})}catch(e2){}}})()</script>`

function errorReporter(token: string): string {
  return `<script>(function(){var q=function(m){try{parent.postMessage({__vibe95:'${token}',message:String(m).slice(0,400)},'*')}catch(e){}};window.addEventListener('error',function(e){q((e.message||'Script error')+(e.lineno?' (line '+e.lineno+')':''))});window.addEventListener('unhandledrejection',function(e){var r=e.reason;q('Unhandled promise rejection: '+((r&&r.message)||r))})})()</script>`
}

/**
 * Programs are self-contained by contract, so block every network channel a
 * malicious (or hallucinated) program could use to phone home or exfiltrate:
 * no fetch/XHR/WebSocket, no remote scripts/styles/images/fonts, no form
 * posts. Inline code and data:/blob: assets — all a legit program needs —
 * still work. This is the runtime enforcement behind verify.ts's advisory
 * "no external URLs" check, and it matters most for programs shared by OTHER
 * users via Vibe Chat.
 */
const RUNNER_CSP =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; ` +
  `script-src 'unsafe-inline'; style-src 'unsafe-inline'; ` +
  `img-src data: blob:; media-src data: blob:; font-src data:; ` +
  `connect-src 'none'; form-action 'none'; base-uri 'none'">`

/** Prepare generated HTML to run in the sandbox, optionally reporting errors. */
export function buildRunnerDoc(html: string, reportToken?: string): string {
  const inject =
    RUNNER_CSP + (reportToken ? errorReporter(reportToken) : '') + STORAGE_SHIM + FOCUS_SHIM
  const m = html.match(/<head[^>]*>/i)
  if (m && m.index !== undefined) {
    const at = m.index + m[0].length
    return html.slice(0, at) + inject + html.slice(at)
  }
  return inject + html
}
