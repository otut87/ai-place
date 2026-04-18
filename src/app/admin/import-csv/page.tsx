import { requireAuth } from '@/lib/auth'
import { CsvImportClient } from './csv-import-client'

export default async function AdminImportCsvPage() {
  await requireAuth()
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-[#222222] mb-2">CSV 일괄 등록</h1>
      <p className="text-sm text-[#6a6a6a] mb-8">
        CSV 헤더: <code className="px-1 bg-[#f0f0f0] rounded">name, city, category, slug, address, phone, description, tags</code>
      </p>
      <CsvImportClient />
    </div>
  )
}
