# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md
@docs/AIPLACE의 제작 철학.md

## Commands

```bash
npm run dev      # Start dev server (Next.js 16)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint (flat config, next/core-web-vitals + next/typescript)
```

## Stack

- **Next.js 16.2.3** with App Router — React 19, `params` and `searchParams` are `Promise<>` in page/layout props
- **Tailwind CSS v4** with `@tailwindcss/postcss` (not v3 config format)
- **shadcn** (v4, base-nova style) using **@base-ui/react** primitives + CVA for variants
- **Supabase** (@supabase/supabase-js + @supabase/ssr) — deps installed, not yet configured
- **TypeScript** strict mode, path alias `@/*` → `./src/*`

## Next.js 16 Breaking Changes

**Read `node_modules/next/dist/docs/` before writing any code.** Key differences from training data:

- Page/layout `params` and `searchParams` are **Promises** — must `await` them
- Consult `node_modules/next/dist/docs/01-app/` for App Router API reference
- Check `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md` for metadata/SEO patterns

## Architecture

- `src/app/` — App Router pages and layouts
- `src/components/ui/` — shadcn UI components (Button uses @base-ui/react + CVA)
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- CSS theme variables defined in `src/app/globals.css` using OKLch color space; dark mode via `.dark` class

## Conventions

- Components use CVA for variant styling, `cn()` for class merging
- Icon library: lucide-react
- ESLint flat config (eslint.config.mjs), ignores `.next/`, `out/`, `build/`


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