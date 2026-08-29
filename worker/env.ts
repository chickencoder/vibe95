import type { GenerationJob } from './generator'
import type { VibeRoom } from './chat'

/** Structural type for the Email Sending binding (send_email in wrangler.jsonc). */
export interface EmailSender {
  send(message: {
    to: string
    from: { email: string; name?: string }
    subject: string
    text: string
    html?: string
  }): Promise<unknown>
}

export interface Env {
  DB: D1Database
  EMAIL?: EmailSender
  ASSETS: Fetcher
  GENERATOR: DurableObjectNamespace<GenerationJob>
  CHAT: DurableObjectNamespace<VibeRoom>
  OPENROUTER_API_KEY?: string
  BETTER_AUTH_SECRET?: string
  MIGRATE_TOKEN?: string
  EMAIL_FROM: string
  APP_NAME: string
}
