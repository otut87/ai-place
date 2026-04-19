// Owner 업체 등록 — admin 플로우와 동일(검색 → 선택 → 자동채움 → 수정 → 저장).
import { requireOwnerUser } from '@/lib/owner/auth'
import { getCities, getCategories } from '@/lib/data.supabase'
import { OwnerRegisterForm } from './owner-register-form'

export const dynamic = 'force-dynamic'

export default async function NewPlacePage() {
  await requireOwnerUser()
  const [cities, categories] = await Promise.all([getCities(), getCategories()])

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[#222222]">새 업체 등록</h1>
        <p className="mt-1 text-xs text-[#6a6a6a]">
          업체명을 검색하면 네이버·Google 에서 정보를 자동으로 채워줍니다. 확인하고 등록만 하면 끝.
        </p>
      </header>

      <OwnerRegisterForm
        cities={cities.map(c => ({ slug: c.slug, name: c.name }))}
        categories={categories.map(c => ({ slug: c.slug, name: c.name, sector: c.sector }))}
      />
    </div>
  )
}
