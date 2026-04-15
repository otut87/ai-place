/**
 * GEO / SEO / AEO 빌드 후 검증 스크립트
 *
 * `npm run build` 후 자동 실행.
 * .next/server/app/ 의 빌드된 HTML을 읽고, 모든 페이지가
 * GEO/SEO/AEO 체크리스트를 통과하는지 검증한다.
 *
 * 실패 시 exit code 1 → CI/배포 차단.
 *
 * 실행: npx tsx scripts/validate-pages.ts
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const BUILD_DIR = resolve(ROOT, '.next/server/app')

// ── 페이지 유형 분류 ──

type PageType = 'home' | 'category' | 'profile' | 'compare' | 'guide' | 'keyword' | 'other'

function classifyPage(relativePath: string): PageType {
  if (relativePath === 'index.html') return 'home'
  if (relativePath.match(/^compare\//)) return 'compare'
  if (relativePath.match(/^guide\//)) return 'guide'
  if (relativePath.match(/\/k\//)) return 'keyword'
  if (relativePath.match(/^admin\//)) return 'other'
  // /cheonan/dermatology.html = category
  // /cheonan/dermatology/soo-derm.html = profile
  const parts = relativePath.replace('.html', '').split('/')
  if (parts.length === 2) return 'category'  // city/category
  if (parts.length === 3) return 'profile'   // city/category/slug
  return 'other'
}

// ── 체크리스트 정의 ──

interface Check {
  name: string
  test: (html: string) => boolean
  required: PageType[]  // 이 페이지 유형에서 필수
}

const checks: Check[] = [
  // === SEO ===
  {
    name: 'canonical URL',
    test: (html) => html.includes('rel="canonical"'),
    required: ['home', 'category', 'profile', 'compare', 'guide', 'keyword'],
  },
  {
    name: 'og:title',
    test: (html) => html.includes('property="og:title"'),
    required: ['home', 'category', 'profile', 'compare', 'guide', 'keyword'],
  },
  {
    name: 'og:description',
    test: (html) => html.includes('property="og:description"'),
    required: ['home', 'category', 'profile', 'compare', 'guide', 'keyword'],
  },
  {
    name: 'og:url',
    test: (html) => html.includes('property="og:url"'),
    required: ['home', 'category', 'profile', 'compare', 'guide', 'keyword'],
  },
  {
    name: 'meta description',
    test: (html) => html.includes('name="description"'),
    required: ['home', 'category', 'profile', 'compare', 'guide', 'keyword'],
  },

  // === AEO ===
  {
    name: 'JSON-LD (application/ld+json)',
    test: (html) => html.includes('application/ld+json'),
    required: ['home', 'category', 'profile', 'compare', 'guide', 'keyword'],
  },
  {
    name: 'FAQPage JSON-LD',
    test: (html) => html.includes('"FAQPage"'),
    required: ['home', 'category', 'profile', 'compare', 'guide', 'keyword'],
  },
  {
    name: 'BreadcrumbList JSON-LD',
    test: (html) => html.includes('"BreadcrumbList"'),
    required: ['category', 'profile', 'compare', 'guide', 'keyword'],
  },
  {
    name: 'H1 태그',
    test: (html) => /<h1[\s>]/i.test(html),
    required: ['home', 'category', 'profile', 'compare', 'guide', 'keyword'],
  },

  // === GEO ===
  {
    name: '@id in JSON-LD',
    test: (html) => {
      const jsonLdBlocks = html.match(/<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/gs) ?? []
      return jsonLdBlocks.some(block => block.includes('"@id"'))
    },
    required: ['home', 'profile', 'compare', 'guide', 'keyword'],
  },
  {
    name: 'E-E-A-T author (Person)',
    test: (html) => {
      const jsonLdBlocks = html.match(/<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/gs) ?? []
      return jsonLdBlocks.some(block => block.includes('"Person"'))
    },
    required: ['profile', 'compare', 'guide', 'keyword'],
  },
  {
    name: 'E-E-A-T publisher (Organization)',
    test: (html) => {
      const jsonLdBlocks = html.match(/<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/gs) ?? []
      return jsonLdBlocks.some(block => block.includes('"Organization"'))
    },
    required: ['home', 'profile', 'compare', 'guide', 'keyword'],
  },
  {
    name: 'Freshness (최종 업데이트 또는 dateModified)',
    test: (html) => html.includes('최종 업데이트') || html.includes('dateModified'),
    required: ['category', 'profile', 'compare', 'guide', 'keyword'],
  },

  // === Schema 호환성 (하지 말아야 할 것) ===
  {
    name: 'NO priceRange on Offer',
    test: (html) => {
      const jsonLdBlocks = html.match(/<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/gs) ?? []
      for (const block of jsonLdBlocks) {
        try {
          const content = block.replace(/<[^>]+>/g, '')
          const data = JSON.parse(content)
          if (data.hasOfferCatalog?.itemListElement) {
            for (const offer of data.hasOfferCatalog.itemListElement) {
              if (offer.priceRange) return false
            }
          }
        } catch { /* skip non-JSON blocks */ }
      }
      return true
    },
    required: ['profile'],
  },
  {
    name: 'NO dateModified on LocalBusiness',
    test: (html) => {
      const jsonLdBlocks = html.match(/<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/gs) ?? []
      for (const block of jsonLdBlocks) {
        try {
          const content = block.replace(/<[^>]+>/g, '')
          const data = JSON.parse(content)
          if (data['@type'] === 'MedicalClinic' && data.dateModified) return false
        } catch { /* skip */ }
      }
      return true
    },
    required: ['profile'],
  },

  // === 추가: 부록 A 런칭 체크리스트 갭 ===

  // H1 1개 제한
  {
    name: 'H1 태그 정확히 1개',
    test: (html) => {
      const matches = html.match(/<h1[\s>]/gi) ?? []
      return matches.length === 1
    },
    required: ['home', 'category', 'profile', 'compare', 'guide', 'keyword'],
  },

  // H2/H3 순서 — H3이 H2 전에 나오면 안 됨
  {
    name: 'Heading 순서 (H2 before H3)',
    test: (html) => {
      const h2Pos = html.search(/<h2[\s>]/i)
      const h3Pos = html.search(/<h3[\s>]/i)
      if (h3Pos === -1) return true  // H3 없으면 OK
      if (h2Pos === -1) return false // H3 있는데 H2 없음
      return h2Pos < h3Pos
    },
    required: ['category', 'profile', 'compare', 'guide', 'keyword'],
  },

  // LocalBusiness subtype (MedicalClinic 등)
  {
    name: 'LocalBusiness subtype (not generic)',
    test: (html) => {
      const jsonLdBlocks = html.match(/<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/gs) ?? []
      return jsonLdBlocks.some(block =>
        block.includes('"MedicalClinic"') || block.includes('"HairSalon"') ||
        block.includes('"Dentist"') || block.includes('"HomeAndConstructionBusiness"') ||
        block.includes('"ProfessionalService"') || block.includes('"AutoRepair"')
      )
    },
    required: ['profile'],
  },

  // sameAs URL 존재
  {
    name: 'sameAs in JSON-LD',
    test: (html) => {
      const jsonLdBlocks = html.match(/<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/gs) ?? []
      return jsonLdBlocks.some(block => block.includes('"sameAs"'))
    },
    required: ['profile'],
  },

  // aggregateRating 존재
  {
    name: 'aggregateRating in JSON-LD',
    test: (html) => {
      const jsonLdBlocks = html.match(/<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/gs) ?? []
      return jsonLdBlocks.some(block => block.includes('"AggregateRating"'))
    },
    required: ['profile'],
  },

  // img alt 텍스트 (img 있으면 alt 필수)
  {
    name: 'img alt 텍스트',
    test: (html) => {
      const imgs = html.match(/<img\s[^>]*>/gi) ?? []
      if (imgs.length === 0) return true // 이미지 없으면 pass
      return imgs.every(img => /alt="[^"]+"/i.test(img))
    },
    required: ['home', 'category', 'profile', 'compare', 'guide', 'keyword'],
  },
]

// ── 실행 ──

function findHtmlFiles(): string[] {
  const files: string[] = []
  function walk(dir: string, prefix = '') {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('_')) continue
      const full = resolve(dir, entry)
      const rel = prefix ? `${prefix}/${entry}` : entry
      if (statSync(full).isDirectory()) {
        walk(full, rel)
      } else if (entry.endsWith('.html')) {
        files.push(rel)
      }
    }
  }
  walk(BUILD_DIR)
  return files
}

function main() {
  if (!existsSync(BUILD_DIR)) {
    console.error('빌드 출력 없음. `npm run build` 먼저 실행하세요.')
    process.exit(1)
  }

  const htmlFiles = findHtmlFiles()
  console.log(`\n🔍 GEO/SEO/AEO 검증 시작 — ${htmlFiles.length}개 페이지\n`)

  let totalErrors = 0
  const results: Array<{ file: string; type: PageType; passed: string[]; failed: string[] }> = []

  for (const file of htmlFiles) {
    const type = classifyPage(file)
    if (type === 'other') continue  // admin 등 비대상 페이지 skip

    const html = readFileSync(resolve(BUILD_DIR, file), 'utf-8')
    const passed: string[] = []
    const failed: string[] = []

    for (const check of checks) {
      if (!check.required.includes(type)) continue

      if (check.test(html)) {
        passed.push(check.name)
      } else {
        failed.push(check.name)
      }
    }

    results.push({ file, type, passed, failed })
    totalErrors += failed.length
  }

  // ── 출력 ──

  for (const r of results) {
    const status = r.failed.length === 0 ? '✅' : '❌'
    console.log(`${status} [${r.type}] ${r.file}`)
    if (r.failed.length > 0) {
      for (const f of r.failed) {
        console.log(`   ❌ ${f}`)
      }
    }
  }

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`총 ${results.length}개 페이지, ${totalErrors}개 오류`)

  if (totalErrors > 0) {
    console.log(`\n❌ GEO/SEO/AEO 검증 실패 — 위 오류를 수정하세요.\n`)
    process.exit(1)
  } else {
    console.log(`\n✅ 모든 페이지가 GEO/SEO/AEO 체크리스트를 통과했습니다.\n`)
  }
}

main()
