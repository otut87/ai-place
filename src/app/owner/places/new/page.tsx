// T-151 — Owner 업체 등록 5단계 마법사.
import { requireOwnerUser } from '@/lib/owner/auth'
import { getCities, getCategories } from '@/lib/data.supabase'
import { RegisterWizard } from './register-wizard'

export const dynamic = 'force-dynamic'

export default async function NewPlacePage() {
  await requireOwnerUser()
  const [cities, categories] = await Promise.all([getCities(), getCategories()])

  return (
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">새 업체 등록</h1>
        <p className="mt-1 text-xs text-[#6a6a6a]">
          5단계 · 필수 항목만 채우면 3분 내 완료
        </p>
      </header>

      <RegisterWizard
        cities={cities.map(c => ({ slug: c.slug, name: c.name }))}
        categories={categories.map(c => ({ slug: c.slug, name: c.name, sector: c.sector }))}
      />
    </div>
  )
}
