// T-090 — 카테고리·도시·섹터 마스터 CRUD.
// 원칙: 기존 cities/categories/sectors 테이블만 조작. 신규 테이블 금지.

import { getAdminClient } from '@/lib/supabase/admin-client'

export interface CityRow { id: string; slug: string; name: string; name_en: string; created_at: string }
export interface CategoryRow { id: string; slug: string; name: string; name_en: string; icon: string | null; sector: string; created_at: string }
export interface SectorRow { id?: string; slug: string; name: string; name_en?: string | null }

// ── 도시 ─────────────────────────────
export async function listCities(): Promise<CityRow[]> {
  const admin = getAdminClient()
  if (!admin) return []
  const { data } = await admin.from('cities').select('id, slug, name, name_en, created_at').order('name')
  return (data ?? []) as CityRow[]
}

export async function upsertCity(input: { slug: string; name: string; nameEn: string }): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }
  const slug = normalizeSlug(input.slug)
  const name = input.name.trim()
  if (!slug || !name) return { success: false, error: 'slug·name 필수' }
  const { error } = await admin.from('cities').upsert({ slug, name, name_en: input.nameEn.trim() }, { onConflict: 'slug' })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteCity(slug: string): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // 해당 도시를 쓰는 place 가 있으면 삭제 불가
  const { count } = await admin.from('places').select('id', { count: 'exact', head: true }).eq('city', slug)
  if ((count ?? 0) > 0) {
    return { success: false, error: `${count}개 업체가 이 도시를 사용 중입니다.` }
  }

  const { error } = await admin.from('cities').delete().eq('slug', slug)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── 카테고리 ─────────────────────────────
export async function listCategories(): Promise<CategoryRow[]> {
  const admin = getAdminClient()
  if (!admin) return []
  const { data } = await admin.from('categories').select('id, slug, name, name_en, icon, sector, created_at').order('sector').order('name')
  return (data ?? []) as CategoryRow[]
}

export interface UpsertCategoryInput {
  slug: string
  name: string
  nameEn: string
  sector: string
  icon?: string | null
}

export async function upsertCategory(input: UpsertCategoryInput): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }
  const slug = normalizeSlug(input.slug)
  const name = input.name.trim()
  const sector = input.sector.trim()
  if (!slug || !name || !sector) return { success: false, error: 'slug·name·sector 필수' }
  const { error } = await admin.from('categories').upsert({
    slug, name, name_en: input.nameEn.trim(), sector, icon: input.icon ?? null,
  }, { onConflict: 'slug' })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteCategory(slug: string): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }
  const { count } = await admin.from('places').select('id', { count: 'exact', head: true }).eq('category', slug)
  if ((count ?? 0) > 0) return { success: false, error: `${count}개 업체가 이 업종을 사용 중입니다.` }
  const { error } = await admin.from('categories').delete().eq('slug', slug)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function listSectors(): Promise<SectorRow[]> {
  const admin = getAdminClient()
  if (!admin) return []
  const { data } = await admin.from('sectors').select('slug, name').order('name')
  return (data ?? []) as SectorRow[]
}

function normalizeSlug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export { normalizeSlug }
