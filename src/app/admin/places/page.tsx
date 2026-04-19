import { requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { cachedCities, cachedCategories, cachedSectors } from '@/lib/admin/cached-data'
import { parseListParams, clampPage, buildRange } from '@/lib/admin/places-query'
import { AdminLink } from '@/components/admin/admin-link'
import { PlacesFilterForm } from './places-filter-form'
import { PlacesPagination } from './places-pagination'
import { PlacesTable, type TableRow } from './places-table'

export default async function AdminPlacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAuth()

  const raw = await searchParams
  const params = parseListParams(raw)

  const [cities, sectors, categories] = await Promise.all([cachedCities(), cachedSectors(), cachedCategories()])

  // sector → categories 매핑 (sector 필터가 설정되면 카테고리도 함께 좁힘)
  let categorySlugsForSector: string[] | null = null
  if (params.sector) {
    categorySlugsForSector = categories.filter((c) => c.sector === params.sector).map((c) => c.slug)
  }

  const supabase = await createServerClient()

  // T-065: subscription 필터가 걸리면 해당 상태의 customer_ids 를 먼저 확보.
  let customerIdsFilter: string[] | null = null
  if (params.subscription) {
    const subStatus = params.subscription === 'paid' ? 'active' : params.subscription
    const { data: subRows } = await supabase
      .from('subscriptions')
      .select('customer_id')
      .eq('status', subStatus)
    customerIdsFilter = (subRows ?? []).map((r) => (r as { customer_id: string }).customer_id)
    // 매칭 구독이 0건이면 결과도 0건
    if (customerIdsFilter.length === 0) customerIdsFilter = ['00000000-0000-0000-0000-000000000000']
  }

  let query = supabase
    .from('places')
    .select(
      'id, slug, name, city, category, status, rating, review_count, phone, tags, quality_score, customer_id, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })

  if (params.q) query = query.ilike('name', `%${params.q}%`)
  if (params.city) query = query.eq('city', params.city)
  if (params.category) query = query.eq('category', params.category)
  else if (categorySlugsForSector && categorySlugsForSector.length > 0) {
    query = query.in('category', categorySlugsForSector)
  }
  if (params.status) query = query.eq('status', params.status)
  if (params.minQualityScore !== null) query = query.gte('quality_score', params.minQualityScore)
  if (customerIdsFilter) query = query.in('customer_id', customerIdsFilter)

  // 서버에서 count를 먼저 얻기 위해 range는 호출 후 결과의 count로 총 페이지 계산 → 재요청 필요 시 clamp
  const pageSize = params.pageSize
  const { from, to } = buildRange(params.page, pageSize)
  const { data, count, error } = await query.range(from, to)

  if (error) {
    console.error('[admin/places] Query failed:', error)
  }

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = clampPage(params.page, totalPages)

  const placesRaw = (data ?? []) as Array<TableRow & { customer_id: string | null }>

  // T-065: 현재 페이지 업체들의 구독 상태를 일괄 조회해 각 행에 주입
  const customerIds = Array.from(new Set(placesRaw.map((p) => p.customer_id).filter((x): x is string => !!x)))
  const subByCustomer = new Map<string, string>()
  if (customerIds.length > 0) {
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('customer_id, status')
      .in('customer_id', customerIds)
    for (const s of (subs ?? []) as Array<{ customer_id: string; status: string }>) {
      subByCustomer.set(s.customer_id, s.status)
    }
  }
  const places: TableRow[] = placesRaw.map((p) => ({
    ...p,
    subscription_status: p.customer_id ? subByCustomer.get(p.customer_id) ?? null : null,
  }))

  // Pagination 컴포에 넘길 기본 쿼리 (page 제외)
  const baseParams = new URLSearchParams()
  if (params.q) baseParams.set('q', params.q)
  if (params.city) baseParams.set('city', params.city)
  if (params.category) baseParams.set('category', params.category)
  if (params.sector) baseParams.set('sector', params.sector)
  if (params.status) baseParams.set('status', params.status)
  if (params.subscription) baseParams.set('subscription', params.subscription)
  if (params.minQualityScore !== null) baseParams.set('min_quality_score', String(params.minQualityScore))
  if (params.pageSize !== 20) baseParams.set('pageSize', String(params.pageSize))

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#222222]">업체 목록</h1>
          <p className="mt-1 text-sm text-[#6a6a6a]">
            총 {total.toLocaleString()}개 · {safePage}/{totalPages} 페이지
          </p>
        </div>
        <AdminLink
          href="/admin/register"
          className="h-10 px-4 inline-flex items-center rounded-lg bg-[#222222] text-white text-sm font-medium"
        >
          새 업체 등록
        </AdminLink>
      </div>

      <PlacesFilterForm
        cities={cities.map((c) => ({ value: c.slug, label: c.name }))}
        sectors={sectors.map((s) => ({ value: s.slug, label: s.name }))}
        categories={categories.map((c) => ({ value: c.slug, label: c.name, sector: c.sector }))}
      />

      {places.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#dddddd] p-12 text-center">
          <p className="text-[#6a6a6a]">
            {total === 0 && !params.q && !params.city && !params.category && !params.sector && !params.status
              ? '등록된 업체가 없습니다.'
              : '검색 결과가 없습니다. 필터를 조정해 보세요.'}
          </p>
        </div>
      ) : (
        <PlacesTable places={places} />
      )}

      <PlacesPagination currentPage={safePage} totalPages={totalPages} baseParams={baseParams} />
    </div>
  )
}
