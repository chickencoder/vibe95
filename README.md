# Vibe95

An online vibe-coding platform trapped inside Windows 95. Log on with your e-mail, describe a program in **Vibe Studio**, watch the AI write it (syntax-highlighted, streaming), and it launches in its own window the moment it's done. **Save As...** puts a `.EXE` on your desktop, stored in your account in the cloud.

## Stack

- **Cloudflare Workers + D1** — Hono API, per-user program storage, daily generation limits
- **Durable Objects** — each generation runs server-side in its own `GenerationJob` DO; refresh the page mid-generation and the client re-attaches to the stream at its last offset (`POST /api/generate` → jobId, `GET /api/generate/:id/stream?from=N`). A 2-minute stall watchdog fails silent jobs.
- **Program QA loop** — after generation, the client checks structure, syntax-checks every inline script, and renders the program in a hidden sandboxed iframe watching for runtime errors; problems are sent back to the model for up to 2 automatic fix rounds before launch.
- **Better Auth** — username + password sign-in (`username` plugin; sign in with username or e-mail), D1 binding passed straight in. Email OTP plugin still mounted for future flows.
- **Silent retries** — the generation DO retries failed, empty, or tiny (<200 char) responses up to 3 times with backoff before surfacing an error; a retry after partial output emits a `reset` event so attached clients restart cleanly. Default model is `openrouter/free` (the free-models router), so retries + the client-side QA/repair loop carry the reliability load.
- **Cloudflare Email Service** — `send_email` binding delivers logon codes
- **OpenRouter** — model-agnostic streaming generation; the model picker is populated live
- **Vite + React** frontend with the `@cloudflare/vite-plugin` (one dev server, one deploy)
- **Landing page** — signed-out visitors get `src/components/Landing.tsx`: a scripted Vibe Studio demo that "writes" and runs PONG.EXE, then features, pricing ($0.00) and help. `#logon` and `#new-user` open the logon dialog (Back returns to the page); an idea typed into the demo is carried into Vibe Studio after sign-up.
- Hand-rolled pixel-faithful Win95 chrome; programs run in sandboxed `iframe srcdoc` with an in-memory localStorage shim (opaque-origin iframes can't touch real localStorage)

## Local dev

```bash
npm install
# .dev.vars needs: OPENROUTER_API_KEY=..., BETTER_AUTH_SECRET=...
npm run dev
curl -X POST http://localhost:5173/api/migrate   # once, creates tables in local D1
```

Logon codes appear in the dev server terminal (wrangler simulates the email binding locally).

## Deploying to Cloudflare

1. `wrangler login`
2. ~~`wrangler d1 create vibe95`~~ — done; the id is already in `wrangler.jsonc`
3. `wrangler email sending enable <yourdomain.com>` and set `EMAIL_FROM` in `wrangler.jsonc` to an address on that domain (DNS records must be added per the command's output)
4. Secrets: `wrangler secret put OPENROUTER_API_KEY`, `wrangler secret put BETTER_AUTH_SECRET`, `wrangler secret put MIGRATE_TOKEN`
5. Add your production origin to `trustedOrigins` in `worker/auth.ts`
6. Replace every `https://vibe95.example.com` in `index.html` (canonical, og:url, og:image, twitter:image, JSON-LD) with the production origin — social scrapers need absolute URLs
7. `npm run deploy`
8. Once: `curl -X POST https://<your-app>/api/migrate -H "x-migrate-token: <MIGRATE_TOKEN>"`

SEO assets live in `public/`: `favicon.ico`/`favicon.svg`/`apple-touch-icon.png`/`icon-{192,512}.png`, `og.png` (1200x630), `robots.txt`, `site.webmanifest`. Source pages to regenerate them (headless-Chrome screenshots) are not checked in; the pixel art is plain SVG in `favicon.svg`.

Users spend your OpenRouter credits; `DAILY_GENERATION_LIMIT` in `worker/index.ts` (default 100/user/day) is the throttle. Set a spend cap on the OpenRouter key too.
