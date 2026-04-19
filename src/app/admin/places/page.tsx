import { requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { logSupabaseError, formatUserFacingError } from '@/lib/supabase/error'
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

  // 마이그레이션 020(billing) 적용 전인 DB 도 지원. 핵심 places 쿼리를 먼저 시도해 컬럼 존재 여부 감지.
  const BILLING_COLUMNS = 'customer_id'
  const CORE_COLUMNS = 'id, slug, name, city, category, status, rating, review_count, phone, tags, quality_score, created_at'

  function buildFilteredQuery(cols: string, customerFilter: string[] | null) {
    let q = supabase
      .from('places')
      .select(cols, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (params.q) q = q.ilike('name', `%${params.q}%`)
    if (params.city) q = q.eq('city', params.city)
    if (params.category) q = q.eq('category', params.category)
    else if (categorySlugsForSector && categorySlugsForSector.length > 0) {
      q = q.in('category', categorySlugsForSector)
    }
    if (params.status) q = q.eq('status', params.status)
    if (params.minQualityScore !== null) q = q.gte('quality_score', params.minQualityScore)
    if (customerFilter) q = q.in('customer_id', customerFilter)
    return q
  }

  // T-065: subscription 필터가 걸리면 해당 상태의 customer_ids 를 먼저 확보.
  let customerIdsFilter: string[] | null = null
  let billingSchemaPresent = true
  if (params.subscription) {
    const subStatus = params.subscription === 'paid' ? 'active' : params.subscription
    const { data: subRows, error: subErr } = await supabase
      .from('subscriptions')
      .select('customer_id')
      .eq('status', subStatus)
    if (subErr && (subErr.code === '42P01' || subErr.code === '42703')) {
      billingSchemaPresent = false
    } else {
      customerIdsFilter = (subRows ?? []).map((r) => (r as { customer_id: string }).customer_id)
      if (customerIdsFilter.length === 0) customerIdsFilter = ['00000000-0000-0000-0000-000000000000']
    }
  }

  const pageSize = params.pageSize
  const { from, to } = buildRange(params.page, pageSize)

  // 1차 시도: customer_id 포함
  let { data, count, error } = await buildFilteredQuery(
    `${CORE_COLUMNS}, ${BILLING_COLUMNS}`,
    customerIdsFilter,
  ).range(from, to)

  // customer_id 컬럼이 없다면 (마이그레이션 020 미적용) core 컬럼만으로 재시도
  if (error && error.code === '42703' && /customer_id/.test(error.message ?? '')) {
    billingSchemaPresent = false
    logSupabaseError('admin/places', error)
    const retry = await buildFilteredQuery(CORE_COLUMNS, null).range(from, to)
    data = retry.data
    count = retry.count
    error = retry.error
  } else if (error) {
    logSupabaseError('admin/places', error)
  }

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = clampPage(params.page, totalPages)

  const placesRaw = (data ?? []) as Array<TableRow & { customer_id?: string | null }>

  // T-065: 현재 페이지 업체들의 구독 상태를 일괄 조회해 각 행에 주입.
  //        마이그레이션 020 미적용 DB 는 billingSchemaPresent=false 로 건너뛴다.
  const subByCustomer = new Map<string, string>()
  if (billingSchemaPresent) {
    const customerIds = Array.from(
      new Set(placesRaw.map((p) => p.customer_id).filter((x): x is string => !!x)),
    )
    if (customerIds.length > 0) {
      const { data: subs, error: subsErr } = await supabase
        .from('subscriptions')
        .select('customer_id, status')
        .in('customer_id', customerIds)
      if (subsErr && (subsErr.code === '42P01' || subsErr.code === '42703')) {
        billingSchemaPresent = false
      } else {
        for (const s of (subs ?? []) as Array<{ customer_id: string; status: string }>) {
          subByCustomer.set(s.customer_id, s.status)
        }
      }
    }
  }
  const places: TableRow[] = placesRaw.map((p) => ({
    ...p,
    subscription_status: billingSchemaPresent && p.customer_id ? subByCustomer.get(p.customer_id) ?? null : null,
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

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">업체 목록을 불러오지 못했습니다</p>
          <p className="mt-1 text-red-700">{formatUserFacingError(error)}</p>
        </div>
      ) : null}

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
