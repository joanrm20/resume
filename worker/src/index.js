/**
 * "Chat with my CV" backend — a Cloudflare Worker that proxies questions to
 * Claude. Secrets (ANTHROPIC_API_KEY, PASS_KEY) are set with
 * `wrangler secret put` and never live in this repo.
 *
 * Defense in depth:
 *   - Pass key checked (constant-time) before Claude is ever called.
 *   - CORS locked to ALLOWED_ORIGIN.
 *   - Input/output bounded; cheap model.
 *   - Hard backstop: set a monthly spend cap on a dedicated key in the
 *     Anthropic Console — see worker/README.md.
 */
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5'
const MAX_QUESTION_CHARS = 600
const MAX_TOKENS = 600

const SYSTEM = `You are a friendly assistant on Jose Ramirez Mora's personal résumé site. \
You answer questions about Jose's career using ONLY the résumé data provided below. \
Speak about Jose in the third person ("Jose led…", "He has…"). Be concise and warm — \
a few sentences at most. If the answer isn't in the résumé, say you don't have that \
detail and suggest reaching out to Jose directly via the links on the site. Never \
invent employers, dates, metrics, or skills that aren't in the data. Decline anything \
unrelated to Jose's professional background.`

// Cached for the lifetime of the isolate — the résumé rarely changes.
let resumeContext = null

async function getResumeContext(env) {
  if (resumeContext) return resumeContext
  const url = env.RESUME_URL || 'https://joanrm20.me/resume.json'
  console.log('[cv-chat] fetching résumé from:', JSON.stringify(url))
  try {
    const res = await fetch(url)
    console.log('[cv-chat] résumé fetch status:', res.status)
    if (res.ok) {
      resumeContext = JSON.stringify(await res.json())
      console.log('[cv-chat] résumé context length:', resumeContext.length)
    }
  } catch (err) {
    console.log('[cv-chat] résumé fetch error:', err && err.message)
  }
  return resumeContext || '{}'
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGIN || 'https://joanrm20.me')
    .split(',')
    .map((s) => s.trim())
  // Always allow localhost so `wrangler dev` + `pnpm preview` work without config.
  const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin)
  const allow = allowed.includes(origin) || isLocalhost ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request.headers.get('Origin') || '', env)

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors)

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'invalid_json' }, 400, cors)
    }

    const passKey = String(body.passKey || '')
    const question = String(body.question || '').trim()

    if (!env.PASS_KEY || !timingSafeEqual(passKey, env.PASS_KEY)) {
      return json(
        { error: 'invalid_pass_key', message: 'That pass key isn’t right. Ask Jose for it 🙂' },
        401,
        cors,
      )
    }
    if (!question) return json({ error: 'empty_question' }, 400, cors)
    if (question.length > MAX_QUESTION_CHARS) {
      return json({ error: 'question_too_long', message: 'That question is a bit long — try trimming it.' }, 413, cors)
    }

    const context = await getResumeContext(env)
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

    let message
    try {
      message = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          { type: 'text', text: SYSTEM },
          {
            type: 'text',
            text: `Résumé data (JSON Resume):\n\n${context}`,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: question }],
      })
    } catch {
      return json({ error: 'upstream_error', message: 'The assistant is unavailable right now.' }, 502, cors)
    }

    if (message.stop_reason === 'refusal') {
      return json(
        { answer: 'I can only help with questions about Jose’s professional background.' },
        200,
        cors,
      )
    }

    const answer = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    return json({ answer }, 200, cors)
  },
}
