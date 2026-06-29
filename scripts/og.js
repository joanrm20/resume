/**
 * Render the /og card to a 1200×630 PNG with puppeteer (same toolchain as the
 * PDF). Writes to public/og.png (committed source asset, served at /og.png) and
 * dist/og.png so the current build is complete.
 *
 *   pnpm build && pnpm og
 */
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
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
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
    await page.goto(`http://localhost:${port}/og/`, { waitUntil: 'networkidle0' })
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } })
    await writeFile(join(ROOT, 'public', 'og.png'), png)
    await writeFile(join(DIST, 'og.png'), png)
    console.log(`✓ public/og.png and dist/og.png (${(png.length / 1024).toFixed(0)} KB)`)
  } catch (err) {
    console.error('OG image generation failed:', err.message)
    process.exitCode = 1
  } finally {
    await browser?.close()
    server.close()
  }
})
