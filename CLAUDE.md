# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md
@docs/AIPLACE의 제작 철학.md

## Commands

```bash
npm run dev          # Start dev server (Next.js 16)
npm run build        # Production build + page validation (validate-pages.ts)
npm run build:only   # Production build without validation
npm run start        # Start production server
npm run lint         # ESLint (flat config, next/core-web-vitals + next/typescript)
npm run test         # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
```

Tests live in `src/lib/__tests__/`. To run a single test: `npx vitest run src/lib/__tests__/<file>.test.ts`

## Stack

- **Next.js 16.2.3** with App Router — React 19, `params` and `searchParams` are `Promise<>` in page/layout props
- **Tailwind CSS v4** with `@tailwindcss/postcss` (not v3 config format)
- **shadcn** (v4, base-nova style) using **@base-ui/react** primitives + CVA for variants
- **Supabase** — auth (email whitelist), RLS, migrations in `supabase/migrations/` (numbered SQL)
- **TypeScript** strict mode, path alias `@/*` → `./src/*`
- **Vitest** for unit tests, **@anthropic-ai/sdk** for AI features

## Next.js 16 Breaking Changes

**Read `node_modules/next/dist/docs/` before writing any code.** Key differences from training data:

- Page/layout `params` and `searchParams` are **Promises** — must `await` them
- Consult `node_modules/next/dist/docs/01-app/` for App Router API reference
- Check `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md` for metadata/SEO patterns

## Architecture

### Route structure

- `/` — Home
- `/[city]/[category]` — Category listing (e.g. `/cheonan/dermatology`)
- `/[city]/[category]/[slug]` — Place detail
- `/[city]/[category]/k/[keyword]` — AI keyword landing page
- `/compare/[city]/[category]/[topic]` — Comparison articles
- `/guide/[city]/[category]` — Category guides
- `/admin/*` — Protected admin (login, place CRUD, registration)
- `/feed.xml`, `/llms.txt`, `/sitemap.ts`, `/robots.ts` — SEO/AI crawler routes

### Data layer

- `src/lib/data.ts` — Seed data (cities, 83 categories in 10 sectors, places) + query functions
- `src/lib/data.supabase.ts` — Supabase adapter with **fallback to seed data** when DB unavailable. Same API surface as `data.ts`
- `src/lib/types.ts` — Core types: `City`, `Sector`, `Category`, `Place`, `ComparisonPage`, `GuidePage`, `KeywordPage`
- `src/lib/supabase-types.ts` — DB row types (`DbPlace`, `DbCity`, etc.) with conversion functions

### Supabase clients (`src/lib/supabase/`)

- `read-client.ts` — Singleton, SSG-safe (no cookies)
- `server.ts` — Server-side with cookie handling
- `admin-client.ts` — Service role key for privileged operations
- `client.ts` — Browser client for auth flows

### Server actions (`src/lib/actions/`)

- `register-place.ts` — Multi-step place registration: Google Places search → enrich from Google/Kakao/Naver APIs
- `manage-place.ts` — Place CRUD with ISR revalidation on public pages

### SEO / Structured data

- `src/lib/seo.ts` — Sitemap generation, breadcrumbs, Direct Answer Blocks
- `src/lib/jsonld.ts` — Schema.org LocalBusiness JSON-LD (MedicalClinic, BeautySalon, etc.)
- `src/middleware.ts` — Admin route auth guard via Supabase session check

### Scripts (`scripts/`)

- `validate-pages.ts` — Post-build page validation (runs in `npm run build`)
- `seed-places.ts` — Populate Supabase with seed data
- `baseline-test.ts` — AI citation testing against ChatGPT/Claude/Gemini
- `indexnow.ts` — Search engine index notification

## Conventions

- Components use CVA for variant styling, `cn()` for class merging
- Icon library: lucide-react
- ESLint flat config (eslint.config.mjs), ignores `.next/`, `out/`, `build/`
- CSS theme variables in `src/app/globals.css` using OKLch color space; dark mode via `.dark` class
- Categories: 83 subcategories across 10 sectors (medical, beauty, living, auto, education, professional, pet, food, wedding, leisure)


## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy,
/canary, /benchmark, /browse, /open-gstack-browser, /qa, /qa-only, /design-review,
/setup-browser-cookies, /setup-deploy, /retro, /investigate, /document-release, /codex,
/cso, /autoplan, /pair-agent, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health