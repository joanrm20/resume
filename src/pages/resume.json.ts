import type { APIRoute } from 'astro'
import { resume } from '../lib/resume'

export const GET: APIRoute = () =>
  new Response(JSON.stringify(resume, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
