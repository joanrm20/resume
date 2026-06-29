# Jose Ramirez — résumé

Source for [joanrm20.me](https://joanrm20.me): a bespoke résumé site built with
[Astro](https://astro.build), driven by a single [JSON Resume](https://jsonresume.org)
file (`resume.json`). Space Grotesk + Inter with JetBrains Mono terminal
accents, light/dark, near-zero JS. A terminal-style landing, an `/experience`
résumé page, and a `/blog`.

## Develop

```sh
pnpm install
pnpm dev         # local dev server at http://localhost:4321
pnpm build       # static build to dist/
pnpm preview      # preview the production build
pnpm validate    # check resume.json against the JSON Resume schema
```

`resume.json` is the single source of truth — edit it and everything (page,
`/llms.txt`, `/resume.json`, JSON-LD) updates.

## Structure

- `src/lib/resume.ts` — typed data access + `toMarkdown` / `toJsonLd` helpers.
- `src/components/`, `src/layouts/`, `src/pages/` — the site.
- `src/pages/llms.txt.ts` + `src/pages/resume.json.ts` — agent-readable routes
  (`/llms.txt`, `/resume.json`) so AI crawlers and recruiter tooling parse it
  cleanly; JSON-LD `schema.org/Person` is injected in the page head.

## AI tooling

- **`scripts/tailor.js`** — tailor the résumé to a job description with Claude
  (Opus 4.8), reframing existing content only. Runs locally:
  ```sh
  export ANTHROPIC_API_KEY=sk-ant-...
  pnpm tailor path/to/job.txt          # → resume.tailored.json
  pbpaste | pnpm tailor                # JD from clipboard
  ```
- **`.claude/skills/resume-review`** — a `/resume-review` skill that critiques
  résumé content against the senior/staff hiring bar.

## Deploy

`.github/workflows/main.yml` builds with `pnpm build` and publishes `dist/` to
GitHub Pages at the `joanrm20.me` custom domain.
