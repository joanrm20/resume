/**
 * Render the built site to a print PDF.
 *
 * Serves dist/ on an ephemeral port, opens it in headless Chromium with print
 * media emulated, and writes the PDF to both public/ (committed source asset,
 * served at /jose_ramirez_cv.pdf) and dist/ (so the current build is complete).
 *
 *   pnpm build && pnpm pdf
 */
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const OUT_NAME = 'jose_ramirez_cv.pdf'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
}

const server = createServer(async (req, res) => {
  const path = decodeURIComponent((req.url || '/').split('?')[0])
  let file = join(DIST, path)
  if (path.endsWith('/')) file = join(file, 'index.html')
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
})

server.listen(0, async () => {
  const { port } = server.address()
  let browser
  try {
    browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' })
    await page.emulateMediaType('print')
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })

    await writeFile(join(ROOT, 'public', OUT_NAME), pdf)
    await writeFile(join(DIST, OUT_NAME), pdf)
    console.log(`✓ public/${OUT_NAME} and dist/${OUT_NAME} (${(pdf.length / 1024).toFixed(0)} KB)`)
  } catch (err) {
    console.error('PDF generation failed:', err.message)
    process.exitCode = 1
  } finally {
    await browser?.close()
    server.close()
  }
})
