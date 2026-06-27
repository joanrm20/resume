# cv-chat worker

Backend for the "Chat with my CV" widget. A Cloudflare Worker that checks a
**pass key**, then asks Claude (Haiku) a question grounded in the published
`resume.json`.

## Why this is safe to keep in a public repo

There are **no secrets in this code**. The API key and pass key are stored
encrypted in Cloudflare via `wrangler secret put`. `wrangler.toml` only holds
non-sensitive config (allowed origin, résumé URL). Never commit a `.dev.vars`
file — it's gitignored.

## Deploy

```sh
cd worker
pnpm install

# 1. Log in to Cloudflare
pnpm exec wrangler login

# 2. Set the two secrets (stored in Cloudflare, never in git)
pnpm exec wrangler secret put ANTHROPIC_API_KEY   # paste your Anthropic key
pnpm exec wrangler secret put PASS_KEY            # paste a long random pass key

# 3. Deploy — note the printed https://cv-chat.<you>.workers.dev URL
pnpm deploy
```

Then rebuild the site so the widget points at the worker (from the repo root):

```sh
CHAT_ENDPOINT=https://cv-chat.<you>.workers.dev pnpm build
```

## Run locally

To preview the widget answering for real on your machine:

```sh
# 1. In worker/: create secrets for local dev (gitignored)
cp .dev.vars.example .dev.vars      # then edit in your real ANTHROPIC_API_KEY
pnpm install
pnpm dev                            # worker at http://localhost:8787

# 2. In another terminal, from the repo root: build the site against it
CHAT_ENDPOINT=http://localhost:8787 pnpm preview
```

Open the printed `localhost` URL, click **Ask about Jose**, and enter the
`PASS_KEY` from your `.dev.vars`. The worker allows any `localhost` origin, so no
CORS setup is needed for local dev.

## The hard backstop: a spend cap

The pass key blocks abuse, but set a guaranteed ceiling anyway:

1. In the **Anthropic Console**, create a **dedicated API key** (ideally in its
   own workspace) and use that one for `ANTHROPIC_API_KEY` above.
2. Set a **monthly spend limit** on it (e.g. $5–10). Even in the worst case you
   cannot be billed past it.

## Pass key

Pick something long and random, e.g.:

```sh
openssl rand -base64 18
```

Share it with people you want to let chat. To rotate, just
`pnpm exec wrangler secret put PASS_KEY` again — old keys stop working immediately.

## Config

Edit `wrangler.toml` `[vars]`:

- `ALLOWED_ORIGIN` — comma-separated origins allowed to call the worker. Add
  `http://localhost:8080` (or your dev port) while testing locally.
- `RESUME_URL` — where the worker fetches résumé data (defaults to the live
  site). The answer is only ever as current as this file.

## Optional extra hardening

If you ever drop the pass key and make it fully public, add a Cloudflare
**Rate limiting** rule (dashboard, no code) and/or **Turnstile**.
