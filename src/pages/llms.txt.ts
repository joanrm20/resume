import type { APIRoute } from 'astro'
import { resume, toMarkdown, SITE_URL } from '../lib/resume'

export const GET: APIRoute = () => {
  const b = resume.basics
  const header = [
    `# ${b.name}${b.label ? ` — ${b.label}` : ''}`,
    '',
    '> Résumé of a software engineer, published for both humans and AI agents.',
    '> Structured source data lives at /resume.json and a printable PDF at',
    '> /jose_ramirez_cv.pdf.',
    '',
    `- Website: ${SITE_URL}`,
    `- Structured data (JSON Resume): ${SITE_URL}/resume.json`,
    `- PDF: ${SITE_URL}/jose_ramirez_cv.pdf`,
    '',
    '---',
    '',
  ].join('\n')

  // toMarkdown emits its own H1 + summary; drop those two lines under our header.
  const body = toMarkdown().split('\n').slice(2).join('\n').trimStart()

  return new Response(header + body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
