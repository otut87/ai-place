'use server'

// T-090 — 마스터 데이터 CRUD 서버 액션. 어드민 인증 필수.

import { requireAuthForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import {
  upsertCity as upsertCityLib,
  deleteCity as deleteCityLib,
  upsertCategory as upsertCategoryLib,
  deleteCategory as deleteCategoryLib,
  type UpsertCategoryInput,
} from '@/lib/admin/master-data'

export async function upsertCityAction(input: { slug: string; name: string; nameEn: string }) {
  await requireAuthForAction()
  const r = await upsertCityLib(input)
  if (r.success) revalidatePath('/admin/settings/master')
  return r
}

export async function deleteCityAction(slug: string) {
  await requireAuthForAction()
  const r = await deleteCityLib(slug)
  if (r.success) revalidatePath('/admin/settings/master')
  return r
}

export async function upsertCategoryAction(input: UpsertCategoryInput) {
  await requireAuthForAction()
  const r = await upsertCategoryLib(input)
  if (r.success) revalidatePath('/admin/settings/master')
  return r
}

export async function deleteCategoryAction(slug: string) {
  await requireAuthForAction()
  const r = await deleteCategoryLib(slug)
  if (r.success) revalidatePath('/admin/settings/master')
  return r
}
