import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const ROOT = join(__dirname, '..', '..')
export const PUBLIC_DIR = join(ROOT, 'public')
export const RESUME_PATH = join(ROOT, 'resume.json')
export const SITE_URL = 'https://joanrm20.me'

export async function loadResume(path = RESUME_PATH) {
  return JSON.parse(await readFile(path, 'utf-8'))
}

/** "2023-11-01" -> "Nov 2023"; falsy -> "Present" */
export function formatDate(value) {
  if (!value) return 'Present'
  const [year, month] = value.split('-')
  if (!month) return year
  const name = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ][Number(month) - 1]
  return name ? `${name} ${year}` : year
}

/** Recursively drop undefined, null, and empty arrays/objects. */
function prune(value) {
  if (Array.isArray(value)) {
    const arr = value.map(prune).filter((v) => v !== undefined)
    return arr.length ? arr : undefined
  }
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      const pruned = prune(v)
      if (pruned !== undefined) out[k] = pruned
    }
    return Object.keys(out).length ? out : undefined
  }
  if (value === null || value === '') return undefined
  return value
}

/**
 * Render the resume as a compact Markdown document.
 * Used both for /llms.txt and as grounding context for the LLM tools.
 */
export function toMarkdown(resume) {
  const b = resume.basics ?? {}
  const lines = []

  lines.push(`# ${b.name}${b.label ? ` — ${b.label}` : ''}`)
  lines.push('')
  if (b.summary) {
    lines.push(`> ${b.summary}`)
    lines.push('')
  }

  const facts = []
  if (b.location) {
    const loc = [b.location.city, b.location.region, b.location.countryCode]
      .filter(Boolean)
      .join(', ')
    if (loc) facts.push(`- **Location:** ${loc}`)
  }
  if (b.email) facts.push(`- **Email:** ${b.email}`)
  for (const p of b.profiles ?? []) {
    facts.push(`- **${p.network}:** ${p.url}`)
  }
  if (facts.length) {
    lines.push(...facts, '')
  }

  if (resume.work?.length) {
    lines.push('## Experience', '')
    for (const job of resume.work) {
      const range = `${formatDate(job.startDate)} – ${formatDate(job.endDate)}`
      lines.push(`### ${job.position} · ${job.name}`)
      lines.push(
        `*${range}${job.location ? ` · ${job.location}` : ''}*`,
      )
      if (job.description) lines.push(job.description)
      lines.push('')
      for (const h of job.highlights ?? []) lines.push(`- ${h}`)
      lines.push('')
    }
  }

  if (resume.skills?.length) {
    lines.push('## Skills', '')
    for (const s of resume.skills) {
      lines.push(`- **${s.name}:** ${(s.keywords ?? []).join(', ')}`)
    }
    lines.push('')
  }

  if (resume.education?.length) {
    lines.push('## Education', '')
    for (const e of resume.education) {
      const range = `${formatDate(e.startDate)} – ${formatDate(e.endDate)}`
      const study = [e.studyType, e.area].filter(Boolean).join(', ')
      lines.push(`- **${e.institution}** — ${study} (${range})`)
    }
    lines.push('')
  }

  if (resume.languages?.length) {
    lines.push('## Languages', '')
    for (const l of resume.languages) {
      lines.push(`- ${l.language} — ${l.fluency}`)
    }
    lines.push('')
  }

  if (resume.awards?.length) {
    lines.push('## Awards', '')
    for (const a of resume.awards) {
      lines.push(`- ${a.title} (${formatDate(a.date)}, ${a.awarder})`)
    }
    lines.push('')
  }

  if (resume.projects?.length) {
    lines.push('## Projects', '')
    for (const p of resume.projects) {
      lines.push(`- **${p.name}** — ${p.description}${p.url ? ` (${p.url})` : ''}`)
    }
    lines.push('')
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

/** Build a schema.org Person object (JSON-LD) from the resume. */
export function toJsonLd(resume, siteUrl = SITE_URL) {
  const b = resume.basics ?? {}
  const current = resume.work?.[0]

  return prune({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: b.name,
    jobTitle: b.label,
    description: b.summary,
    image: b.image,
    email: b.email ? `mailto:${b.email}` : undefined,
    url: siteUrl,
    sameAs: (b.profiles ?? []).map((p) => p.url),
    address: b.location && {
      '@type': 'PostalAddress',
      addressLocality: b.location.city,
      addressRegion: b.location.region,
      addressCountry: b.location.countryCode,
    },
    worksFor: current && {
      '@type': 'Organization',
      name: current.name,
      url: current.url,
    },
    alumniOf: (resume.education ?? []).map((e) => ({
      '@type': 'CollegeOrUniversity',
      name: e.institution,
      url: e.url,
    })),
    knowsAbout: (resume.skills ?? []).flatMap((s) => s.keywords ?? []),
    knowsLanguage: (resume.languages ?? []).map((l) => l.language),
  })
}
