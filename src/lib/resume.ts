import data from '../../resume.json'

export const SITE_URL = 'https://joanrm20.me'

export interface Profile {
  network: string
  username?: string
  url: string
}

export interface Basics {
  name: string
  label?: string
  image?: string
  email?: string
  summary?: string
  location?: { city?: string; region?: string; countryCode?: string }
  profiles?: Profile[]
}

export interface WorkItem {
  name: string
  position: string
  location?: string
  description?: string
  url?: string
  startDate: string
  endDate?: string
  highlights?: string[]
}

export interface EducationItem {
  institution: string
  url?: string
  area?: string
  studyType?: string
  startDate?: string
  endDate?: string
}

export interface SkillGroup {
  name: string
  keywords?: string[]
}

export interface Award {
  title: string
  date?: string
  awarder?: string
}

export interface LanguageItem {
  language: string
  fluency?: string
}

export interface Interest {
  name: string
  keywords?: string[]
}

export interface ProjectItem {
  name: string
  description?: string
  url?: string
  keywords?: string[]
  roles?: string[]
}

export interface Resume {
  basics: Basics
  work: WorkItem[]
  education: EducationItem[]
  skills: SkillGroup[]
  awards?: Award[]
  languages?: LanguageItem[]
  interests?: Interest[]
  projects?: ProjectItem[]
}

export const resume = data as Resume

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** "2023-11-01" -> "Nov 2023"; undefined -> "Present" */
export function formatDate(value?: string): string {
  if (!value) return 'Present'
  const [year, month] = value.split('-')
  if (!month) return year
  const name = MONTHS[Number(month) - 1]
  return name ? `${name} ${year}` : year
}

export function dateRange(start?: string, end?: string): string {
  return `${formatDate(start)} — ${formatDate(end)}`
}

/** Whole years between two dates, e.g. "15+ years" for the longest span. */
export function yearsSince(value: string): number {
  return Math.floor((Date.now() - new Date(value).getTime()) / (365.25 * 864e5))
}

export function locationString(loc?: Basics['location']): string {
  if (!loc) return ''
  return [loc.city, loc.region, loc.countryCode].filter(Boolean).join(', ')
}

const EMPHASIS = ['frontend architecture', 'design systems', 'developer experience']

/** Wrap the craft keywords in the summary for subtle emphasis (returns HTML). */
export function emphasize(text: string): string {
  let out = text
  for (const phrase of EMPHASIS) {
    out = out.replaceAll(phrase, `<span class="hi">${phrase}</span>`)
  }
  return out
}

/** Compact Markdown rendering, shared by /llms.txt and LLM grounding. */
export function toMarkdown(r: Resume = resume): string {
  const b = r.basics
  const lines: string[] = []
  lines.push(`# ${b.name}${b.label ? ` — ${b.label}` : ''}`, '')
  if (b.summary) lines.push(`> ${b.summary}`, '')

  const loc = locationString(b.location)
  if (loc) lines.push(`- **Location:** ${loc}`)
  if (b.email) lines.push(`- **Email:** ${b.email}`)
  for (const p of b.profiles ?? []) lines.push(`- **${p.network}:** ${p.url}`)
  lines.push('')

  lines.push('## Experience', '')
  for (const job of r.work) {
    lines.push(`### ${job.position} · ${job.name}`)
    lines.push(`*${dateRange(job.startDate, job.endDate)}${job.location ? ` · ${job.location}` : ''}*`)
    if (job.description) lines.push(job.description)
    lines.push('')
    for (const h of job.highlights ?? []) lines.push(`- ${h}`)
    lines.push('')
  }

  lines.push('## Skills', '')
  for (const s of r.skills) lines.push(`- **${s.name}:** ${(s.keywords ?? []).join(', ')}`)
  lines.push('')

  lines.push('## Education', '')
  for (const e of r.education) {
    const study = [e.studyType, e.area].filter(Boolean).join(', ')
    lines.push(`- **${e.institution}** — ${study} (${dateRange(e.startDate, e.endDate)})`)
  }
  lines.push('')

  if (r.languages?.length) {
    lines.push('## Languages', '')
    for (const l of r.languages) lines.push(`- ${l.language} — ${l.fluency}`)
    lines.push('')
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

/** schema.org Person JSON-LD. */
export function toJsonLd(r: Resume = resume) {
  const b = r.basics
  const current = r.work[0]
  const clean = <T extends Record<string, unknown>>(o: T): T =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== '')) as T

  return clean({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: b.name,
    jobTitle: b.label,
    description: b.summary,
    image: b.image,
    email: b.email ? `mailto:${b.email}` : undefined,
    url: SITE_URL,
    sameAs: (b.profiles ?? []).map((p) => p.url),
    address: b.location && clean({
      '@type': 'PostalAddress',
      addressLocality: b.location.city,
      addressRegion: b.location.region,
      addressCountry: b.location.countryCode,
    }),
    worksFor: current && { '@type': 'Organization', name: current.name, url: current.url },
    alumniOf: r.education.map((e) => ({ '@type': 'CollegeOrUniversity', name: e.institution, url: e.url })),
    knowsAbout: r.skills.flatMap((s) => s.keywords ?? []),
    knowsLanguage: (r.languages ?? []).map((l) => l.language),
  })
}
