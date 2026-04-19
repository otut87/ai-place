// T-090 — /admin/settings/master — 카테고리·지역 마스터 CRUD.

import { requireAuth } from '@/lib/auth'
import { listCities, listCategories, listSectors } from '@/lib/admin/master-data'
import { CityTable } from './city-table'
import { CategoryTable } from './category-table'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function MasterDataPage() {
  await requireAuth()
  const [cities, categories, sectors] = await Promise.all([listCities(), listCategories(), listSectors()])

  return (
    <div className="px-6 py-5">
      <header className="mb-5">
        <h1 className="text-xl font-semibold">마스터 데이터</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">도시·업종·섹터. 업체가 사용 중인 slug 는 삭제할 수 없습니다.</p>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-[#191919]">도시 ({cities.length})</h2>
        <CityTable rows={cities} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-[#191919]">업종 ({categories.length}) · 섹터 {sectors.length}종</h2>
        <CategoryTable rows={categories} sectors={sectors.map(s => ({ slug: s.slug, name: s.name }))} />
      </section>
    </div>
  )
}
