// 3-Source 통합 검색 (T-014)
// Kakao + Google + Naver 병렬 호출 → dedup/merge → MergedCandidate[].

import { kakaoLocalSearch } from './kakao-local'
import { naverLocalSearch } from './naver-local'
import { searchPlaceByText } from '@/lib/google-places'
import { mergeCandidates, type MergedCandidate } from './merge'

async function safeKakao(q: string) {
  try { return await kakaoLocalSearch(q) } catch (e) { console.error('[unified] kakao:', e); return [] }
}
async function safeNaver(q: string) {
  try { return await naverLocalSearch(q) } catch (e) { console.error('[unified] naver:', e); return [] }
}
async function safeGoogle(q: string) {
  try { return (await searchPlaceByText(q)) ?? [] } catch (e) { console.error('[unified] google:', e); return [] }
}

/**
 * 단일 쿼리로 3-Source 검색 + Dedup/Merge.
 * 개별 소스 실패해도 나머지로 진행 (Promise.allSettled 대신 per-source try/catch).
 */
export async function unifiedSearch(query: string): Promise<MergedCandidate[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const [kakao, google, naver] = await Promise.all([
    safeKakao(trimmed),
    safeGoogle(trimmed),
    safeNaver(trimmed),
  ])

  return mergeCandidates({ kakao, google, naver })
}
