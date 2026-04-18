'use server'

import { requireAuthForAction } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'
import { getCities, getCategories } from '@/lib/data'
import {
  parseCsv,
  normalizeRow,
  validateCsvRow,
  type NormalizedRow,
} from '@/lib/admin/csv-import'

export interface CsvImportRowResult {
  rowNumber: number
  name: string
  ok: boolean
  errors: string[]
}

export interface CsvImportResponse {
  success: boolean
  error?: string
  results: CsvImportRowResult[]
  successCount: number
  failureCount: number
}

function rowToInsert(row: NormalizedRow) {
  return {
    slug: row.slug,
    name: row.name,
    city: row.city,
    category: row.category,
    description: row.description,
    address: row.address,
    phone: row.phone || null,
    tags: row.tags.length > 0 ? row.tags : null,
    status: 'pending' as const,
  }
}

export async function importCsvPlaces(csvText: string): Promise<CsvImportResponse> {
  await requireAuthForAction()

  const supabase = getAdminClient()
  if (!supabase) {
    return {
      success: false,
      error: 'Admin 클라이언트 초기화 실패',
      results: [],
      successCount: 0,
      failureCount: 0,
    }
  }

  let parsed
  try {
    parsed = parseCsv(csvText)
  } catch (e) {
    return {
      success: false,
      error: String((e as Error)?.message ?? e),
      results: [],
      successCount: 0,
      failureCount: 0,
    }
  }

  const [cities, categories] = await Promise.all([getCities(), getCategories()])
  const ctx = { cities: cities.map((c) => c.slug), categories: categories.map((c) => c.slug) }

  const results: CsvImportRowResult[] = []
  const inserts: ReturnType<typeof rowToInsert>[] = []

  parsed.rows.forEach((raw, idx) => {
    const rowNumber = idx + 2 // 1 = header line
    const row = normalizeRow(raw, ctx)
    const v = validateCsvRow(row, ctx)
    if (!v.ok) {
      results.push({ rowNumber, name: row.name, ok: false, errors: v.errors })
      return
    }
    results.push({ rowNumber, name: row.name, ok: true, errors: [] })
    inserts.push(rowToInsert(row))
  })

  let successCount = 0
  if (inserts.length > 0) {
    const { error, count } = await supabase.from('places').insert(inserts, { count: 'exact' })
    if (error) {
      return {
        success: false,
        error: `DB 삽입 실패: ${error.message}`,
        results,
        successCount: 0,
        failureCount: parsed.rows.length,
      }
    }
    successCount = count ?? inserts.length
  }

  revalidatePath('/admin/places')
  revalidatePath('/')

  const failureCount = parsed.rows.length - successCount
  return { success: true, results, successCount, failureCount }
}
