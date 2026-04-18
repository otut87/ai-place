// T-066 — /admin/places/[id] 탭 구조 + AI 노출 체크리스트
import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { listAuditForPlace } from '@/lib/actions/audit-places'
import { computeCompleteness, PUBLIC_READY_THRESHOLD } from '@/lib/admin/completeness'
import { parseFieldMeta, summarizeSource, type FieldMetaField } from '@/lib/admin/field-meta'
import { summarizeAction, actorTypeLabel, type AuditAction, type ActorType } from '@/lib/admin/audit'
import { AdminLink } from '@/components/admin/admin-link'
import { User, Bot, Cog, CheckCircle2, AlertTriangle } from 'lucide-react'
import { notFound } from 'next/navigation'

interface Params {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string | string[] }>
}

export const dynamic = 'force-dynamic'

const TABS = [
  { id: 'overview', label: '개요' },
  { id: 'services', label: '서비스' },
  { id: 'faqs', label: 'FAQ' },
  { id: 'tags', label: '태그' },
  { id: 'blog', label: '블로그' },
  { id: 'seo', label: 'SEO' },
  { id: 'pipeline', label: '자동화 이력' },
  { id: 'audit', label: '변경 로그' },
] as const
type TabId = (typeof TABS)[number]['id']

export default async function AdminPlaceDetailPage({ params, searchParams }: Params) {
  await requireAuth()
  const { id } = await params
  const raw = await searchParams
  const tabParam = Array.isArray(raw.tab) ? raw.tab[0] : raw.tab
  const activeTab: TabId = (TABS.find(t => t.id === tabParam)?.id ?? 'overview') as TabId

  const supabase = getAdminClient()
  if (!supabase) return <p className="p-6 text-sm text-red-600">DB 연결 실패</p>

  const { data: row } = await supabase
    .from('places')
    .select('id, slug, name, city, category, status, description, address, phone, opening_hours, services, faqs, tags, images, naver_place_url, kakao_map_url, field_meta, quality_score, created_at, updated_at')
    .eq('id', id)
    .single()

  if (!row) notFound()

  const place = row as unknown as PlaceRow
  const completeness = computeCompleteness(place)
  const meta = parseFieldMeta(place.field_meta)

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <header className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs text-[#6a6a6a]">/{place.city}/{place.category}/{place.slug}</p>
          <h1 className="mt-0.5 text-xl font-semibold text-[#222222]">{place.name}</h1>
          <p className="mt-1 text-xs text-[#6a6a6a]">
            상태 <span className="font-medium">{place.status}</span>
            {place.quality_score != null && <> · 품질 {place.quality_score}점</>}
            · 수정 {place.updated_at ? new Date(place.updated_at).toLocaleString('ko-KR') : '—'}
          </p>
        </div>
        <div className="flex gap-2">
          <AdminLink href={`/admin/places/${place.id}/edit`} className="h-9 rounded-md border border-[#dddddd] bg-white px-3 text-xs text-[#484848] hover:bg-[#f3f4f6]">
            기존 편집폼 열기
          </AdminLink>
          <AdminLink href={`/admin/places/${place.id}/history`} className="h-9 rounded-md bg-[#222222] px-3 text-xs text-white hover:opacity-90">
            변경 이력 전체 보기
          </AdminLink>
        </div>
      </header>

      {completeness.score < PUBLIC_READY_THRESHOLD && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#854d0e]">
          <AlertTriangle className="h-4 w-4" />
          완성도 {completeness.score}점 — {PUBLIC_READY_THRESHOLD}점 미만이므로 공개 노출 품질이 낮습니다.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        {/* 본문: 탭 */}
        <div>
          <nav className="mb-3 flex flex-wrap gap-1 border-b border-[#e5e7eb]">
            {TABS.map(t => {
              const active = t.id === activeTab
              return (
                <AdminLink
                  key={t.id}
                  href={`/admin/places/${place.id}?tab=${t.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-t-md px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? 'bg-white text-[#00a67c] shadow-[0_1px_0_0_#00a67c]'
                      : 'text-[#6a6a6a] hover:bg-[#f3f4f6]'
                  }`}
                >
                  {t.label}
                </AdminLink>
              )
            })}
          </nav>

          <section className="rounded-md border border-[#e5e7eb] bg-white p-4">
            {activeTab === 'overview' && <OverviewTab place={place} meta={meta} />}
            {activeTab === 'services' && <ListTab items={place.services ?? []} kind="services" meta={meta} />}
            {activeTab === 'faqs' && <FaqsTab items={place.faqs ?? []} meta={meta} />}
            {activeTab === 'tags' && <TagsTab tags={place.tags ?? []} meta={meta} />}
            {activeTab === 'blog' && <StubTab task="T-078" label="블로그 연동" />}
            {activeTab === 'seo' && <StubTab task="T-081" label="SEO / AI 봇 방문" />}
            {activeTab === 'pipeline' && <StubTab task="T-076" label="자동화 파이프라인 이력" />}
            {activeTab === 'audit' && <AuditTab placeId={place.id} />}
          </section>
        </div>

        {/* 사이드바: 체크리스트 */}
        <aside className="rounded-md border border-[#e5e7eb] bg-white p-4">
          <h2 className="text-sm font-semibold text-[#222222]">AI 노출 체크리스트</h2>
          <p className="mt-1 text-xs text-[#6a6a6a]">
            완성도 <span className="font-medium text-[#222222]">{completeness.score}점</span> / 100점
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f3f4f6]">
            <div
              className="h-full rounded-full bg-[#00a67c]"
              style={{ width: `${completeness.score}%` }}
            />
          </div>
          <ul className="mt-3 space-y-1.5 text-xs">
            {completeness.items.map(item => (
              <li key={item.id} className="flex items-center justify-between">
                <span className={item.passed ? 'text-[#222222]' : 'text-[#9ca3af]'}>
                  {item.passed ? '✓' : '○'} {item.label}
                </span>
                <span className="text-[10px] text-[#9ca3af]">{item.weight}점</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}

interface PlaceRow {
  id: string
  slug: string
  name: string
  city: string
  category: string
  status: string
  description: string | null
  address: string | null
  phone: string | null
  opening_hours: string[] | null
  services: Array<{ name: string; description?: string; priceRange?: string }> | null
  faqs: Array<{ question: string; answer: string }> | null
  tags: string[] | null
  images: unknown
  naver_place_url: string | null
  kakao_map_url: string | null
  field_meta: unknown
  quality_score: number | null
  created_at: string
  updated_at: string | null
}

function MetaChip({ field, meta }: { field: FieldMetaField; meta: ReturnType<typeof parseFieldMeta> }) {
  const entry = meta[field]
  const label = summarizeSource(entry)
  if (!label) return null
  const ai = entry?.source.startsWith('ai:')
  const cls = ai
    ? 'bg-[#ede9fe] text-[#4c1d95]'
    : 'bg-[#f3f4f6] text-[#484848]'
  return <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${cls}`}>{label}</span>
}

function OverviewTab({ place, meta }: { place: PlaceRow; meta: ReturnType<typeof parseFieldMeta> }) {
  return (
    <dl className="grid gap-3 text-sm">
      <Row label="설명">
        <MetaChip field="description" meta={meta} />
        <p className="mt-1 whitespace-pre-wrap text-[#222222]">{place.description ?? <em className="text-[#9ca3af]">없음</em>}</p>
      </Row>
      <Row label="주소">{place.address ?? <em className="text-[#9ca3af]">없음</em>}</Row>
      <Row label="전화">{place.phone ?? <em className="text-[#9ca3af]">없음</em>}</Row>
      <Row label="영업시간">
        {place.opening_hours && place.opening_hours.length > 0 ? (
          <ul className="text-xs text-[#484848]">{place.opening_hours.map((h, i) => <li key={i}>{h}</li>)}</ul>
        ) : <em className="text-[#9ca3af]">없음</em>}
      </Row>
      <Row label="네이버 / 카카오">
        <div className="flex gap-2 text-xs">
          {place.naver_place_url
            ? <a href={place.naver_place_url} className="text-[#4c1d95] underline" target="_blank" rel="noopener noreferrer">네이버</a>
            : <span className="text-[#9ca3af]">네이버 없음</span>}
          {place.kakao_map_url
            ? <a href={place.kakao_map_url} className="text-[#4c1d95] underline" target="_blank" rel="noopener noreferrer">카카오</a>
            : <span className="text-[#9ca3af]">카카오 없음</span>}
        </div>
      </Row>
    </dl>
  )
}

function ListTab({ items, kind, meta }: {
  items: Array<{ name: string; description?: string; priceRange?: string }>
  kind: 'services'
  meta: ReturnType<typeof parseFieldMeta>
}) {
  if (items.length === 0) return <EmptyMessage kind={kind} />
  return (
    <div>
      <MetaChip field={kind} meta={meta} />
      <ul className="mt-2 space-y-2 text-sm">
        {items.map((s, i) => (
          <li key={i} className="rounded border border-[#e5e7eb] bg-[#fafafa] p-2">
            <p className="font-medium text-[#222222]">{s.name}</p>
            {s.priceRange && <p className="text-xs text-[#6a6a6a]">가격: {s.priceRange}</p>}
            {s.description && <p className="mt-1 text-xs text-[#484848]">{s.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FaqsTab({ items, meta }: {
  items: Array<{ question: string; answer: string }>
  meta: ReturnType<typeof parseFieldMeta>
}) {
  if (items.length === 0) return <EmptyMessage kind="faqs" />
  return (
    <div>
      <MetaChip field="faqs" meta={meta} />
      <ol className="mt-2 space-y-2 text-sm">
        {items.map((f, i) => (
          <li key={i} className="rounded border border-[#e5e7eb] bg-[#fafafa] p-2">
            <p className="font-medium text-[#222222]">Q. {f.question}</p>
            <p className="mt-1 text-xs text-[#484848]">A. {f.answer}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function TagsTab({ tags, meta }: { tags: string[]; meta: ReturnType<typeof parseFieldMeta> }) {
  if (tags.length === 0) return <EmptyMessage kind="tags" />
  return (
    <div>
      <MetaChip field="tags" meta={meta} />
      <div className="mt-2 flex flex-wrap gap-1">
        {tags.map(t => (
          <span key={t} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs text-[#484848]">{t}</span>
        ))}
      </div>
    </div>
  )
}

function EmptyMessage({ kind }: { kind: string }) {
  const label = kind === 'services' ? '서비스' : kind === 'faqs' ? 'FAQ' : '태그'
  return <p className="text-sm text-[#6a6a6a]">아직 {label}가 없습니다. 편집폼에서 추가하거나 AI 자동 생성을 이용하세요.</p>
}

function StubTab({ task, label }: { task: string; label: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed border-[#dddddd] bg-[#fafafa] p-4 text-sm text-[#484848]">
      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#9ca3af]" />
      <span>
        <strong>{label}</strong> 탭은 <code className="rounded bg-[#f3f4f6] px-1">{task}</code> 에서 구현 예정입니다.
      </span>
    </div>
  )
}

async function AuditTab({ placeId }: { placeId: string }) {
  const entries = await listAuditForPlace(placeId, 30)
  if (entries.length === 0) {
    return <p className="text-sm text-[#6a6a6a]">아직 기록된 변경 이력이 없습니다.</p>
  }
  return (
    <ol className="space-y-2 text-sm">
      {entries.map(e => (
        <li key={e.id} className="rounded border border-[#e5e7eb] bg-[#fafafa] p-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium text-[#222222]">
              <ActorIcon type={(e.actor_type as ActorType) ?? 'human'} />
              {summarizeAction(e.action as AuditAction, {
                field: e.field ?? undefined,
                before: e.before_value,
                after: e.after_value,
              })}
            </span>
            <time className="text-xs text-[#6a6a6a]">{new Date(e.created_at).toLocaleString('ko-KR')}</time>
          </div>
          {e.reason && <p className="mt-1 text-xs text-[#484848]">사유: {e.reason}</p>}
        </li>
      ))}
    </ol>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-[#6a6a6a]">{label}</dt>
      <dd className="mt-0.5 text-[#222222]">{children}</dd>
    </div>
  )
}

function ActorIcon({ type }: { type: ActorType }) {
  const cls = 'inline-flex h-4 w-4 items-center justify-center rounded-full'
  if (type === 'pipeline') return <span className={`${cls} bg-[#ede9fe] text-[#4c1d95]`} title={actorTypeLabel(type)}><Bot className="h-2.5 w-2.5" /></span>
  if (type === 'system') return <span className={`${cls} bg-[#f3f4f6] text-[#484848]`} title={actorTypeLabel(type)}><Cog className="h-2.5 w-2.5" /></span>
  return <span className={`${cls} bg-[#e6f7f1] text-[#00a67c]`} title={actorTypeLabel(type)}><User className="h-2.5 w-2.5" /></span>
}
