/**
 * Tailor the résumé to a specific job description using Claude.
 *
 * Reads resume.json, sends it together with a job description to Claude, and
 * writes a tailored JSON Resume variant. Claude is instructed to *reframe* and
 * *reorder* existing content only — never to invent experience, employers,
 * dates, metrics, or skills that aren't already present.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... node scripts/tailor.js <job-description.txt>
 *   pbpaste | node scripts/tailor.js                 # read JD from stdin
 *   node scripts/tailor.js jd.txt -o resume.acme.json
 *
 * Flags:
 *   -o, --out <path>   Output JSON path (default: resume.tailored.json)
 *
 * Requires the ANTHROPIC_API_KEY environment variable.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { loadResume, ROOT } from './lib/resume.js'

const MODEL = 'claude-opus-4-8'

const SYSTEM = `You are an expert technical résumé editor. You tailor a candidate's \
JSON Resume to a specific job description so the most relevant experience is \
surfaced and the language aligns with how the target role describes the work.

You operate under strict integrity rules. You MUST:
- Keep every employer, job title, and start/end date exactly as given. Never add, \
remove, merge, or re-date a work entry.
- Never invent achievements, metrics, technologies, or skills. You may only \
reuse facts already present somewhere in the résumé.
- Only reframe, not fabricate: reorder each role's highlights so the most \
relevant ones come first; lightly rephrase highlights, the summary, and the \
label/headline to mirror the job's terminology and emphasis — without changing \
their meaning or strengthening a claim beyond what the original supports.
- Reorder and, if helpful, trim the skills lists to foreground what the job asks \
for. Do not introduce a skill that doesn't already appear in the résumé.
- Preserve the JSON Resume schema and all top-level keys present in the input.

Output ONLY the complete tailored résumé as a single JSON object. No prose, no \
explanation, no Markdown code fences.`

function parseArgs(argv) {
  const args = { out: 'resume.tailored.json', jdFile: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-o' || a === '--out') args.out = argv[++i]
    else if (!a.startsWith('-')) args.jdFile = a
  }
  return args
}

async function readStdin() {
  if (process.stdin.isTTY) return ''
  let data = ''
  process.stdin.setEncoding('utf-8')
  for await (const chunk of process.stdin) data += chunk
  return data
}

function extractJson(text) {
  // Be forgiving if the model wraps output in fences despite instructions.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fenced ? fenced[1] : text).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in the model response.')
  }
  return JSON.parse(candidate.slice(start, end + 1))
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is not set.')
    process.exit(1)
  }

  const args = parseArgs(process.argv.slice(2))
  const jd = (args.jdFile ? await readFile(args.jdFile, 'utf-8') : await readStdin()).trim()

  if (!jd) {
    console.error(
      'Error: no job description provided.\n' +
        'Pass a file path or pipe text via stdin:\n' +
        '  node scripts/tailor.js job.txt\n' +
        '  pbpaste | node scripts/tailor.js',
    )
    process.exit(1)
  }

  const resume = await loadResume()
  const client = new Anthropic()

  console.error(`Tailoring résumé to the job description with ${MODEL}…`)

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Here is the current résumé as JSON Resume:\n\n' +
              '```json\n' +
              JSON.stringify(resume, null, 2) +
              '\n```\n\n' +
              'Here is the target job description:\n\n' +
              '"""\n' +
              jd +
              '\n"""\n\n' +
              'Return the tailored JSON Resume now, following all integrity rules.',
          },
        ],
      },
    ],
  })

  const message = await stream.finalMessage()

  if (message.stop_reason === 'refusal') {
    console.error('The request was declined by the model. Nothing was written.')
    process.exit(1)
  }

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const tailored = extractJson(text)

  const outPath = join(ROOT, args.out)
  await writeFile(outPath, JSON.stringify(tailored, null, 2) + '\n', 'utf-8')
  console.error(`✓ Wrote ${args.out}`)

  const usage = message.usage
  console.error(
    `Tokens — in: ${usage.input_tokens}, out: ${usage.output_tokens}` +
      `. Review the diff against resume.json before using it.`,
  )
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
