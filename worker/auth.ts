import { betterAuth } from 'better-auth'
import { emailOTP, username } from 'better-auth/plugins'
import type { Env } from './env'

export type { Env }

function createAuth(env: Env) {
  // Never fall back to a secret that ships in the repo: sessions signed with
  // a known string are forgeable. Local dev sets this in .dev.vars.
  if (!env.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET is not set (add it via `wrangler secret put` or .dev.vars).')
  }
  return betterAuth({
    database: env.DB, // D1 binding, auto-detected by Better Auth
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true },
    trustedOrigins: ['http://localhost:5173'],
    plugins: [
      username(),
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        async sendVerificationOTP({ email, otp }) {
          if (env.EMAIL) {
            await env.EMAIL.send({
              to: email,
              from: { email: env.EMAIL_FROM, name: env.APP_NAME },
              subject: `${otp} is your ${env.APP_NAME} logon code`,
              text: `Your ${env.APP_NAME} logon code is: ${otp}\n\nIt expires in 10 minutes. It is now safe to log on to your computer.`,
              html: `<p>Your <b>${env.APP_NAME}</b> logon code is:</p><p style="font-size:24px;font-family:monospace"><b>${otp}</b></p><p>It expires in 10 minutes. It is now safe to log on to your computer.</p>`,
            })
          } else {
            // Local dev: no email binding — surface the code in the terminal.
            console.log(`[dev] logon code for ${email}: ${otp}`)
          }
        },
      }),
    ],
  })
}

let cached: ReturnType<typeof createAuth> | null = null

export function getAuth(env: Env) {
  return (cached ??= createAuth(env))
}
