// T-067 — 동일 RSC 렌더 사이클에서 같은 데이터 조회를 메모이제이션.
// React.cache 는 한 요청 내에서만 유효하며 렌더 결과 재사용을 돕는다.
// 추후 data.supabase.ts 로 전환되면 자동으로 실제 DB 호출 메모가 된다.

import { cache } from 'react'
import { getCities, getCategories, getSectors } from '@/lib/data'

export const cachedCities = cache(async () => getCities())
export const cachedCategories = cache(async () => getCategories())
export const cachedSectors = cache(async () => getSectors())
