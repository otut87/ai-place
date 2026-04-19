// T-138 — 벤치마크 비교용 평균 점수.
// 현재는 고정값 (사이트 내 등록 업체 평균은 100점 가까움 — JSON-LD/robots 완비).
// 향후 일 1회 크론에서 실제 측정 후 캐시 갱신 가능.

export interface Benchmark {
  registered: number       // AI Place 에 등록된 업체 평균 점수
  unregistered: number     // 일반 업체 평균 (업계 추정)
  note: string
}

export const DEFAULT_BENCHMARK: Benchmark = {
  registered: 91,
  unregistered: 58,
  note: 'AI Place 등록 업체는 JSON-LD LocalBusiness, robots.txt AI 허용, sitemap, llms.txt 기본 제공',
}

export function getBenchmark(): Benchmark {
  return DEFAULT_BENCHMARK
}

/** 점수를 bucket(0-30-60-90-100) 으로 분류해 라벨 반환. */
export function scoreBucket(score: number): { label: string; tone: 'bad' | 'warn' | 'ok' | 'great' } {
  if (score >= 85) return { label: '우수', tone: 'great' }
  if (score >= 60) return { label: '보통', tone: 'ok' }
  if (score >= 30) return { label: '개선 필요', tone: 'warn' }
  return { label: '심각', tone: 'bad' }
}

/** 업종 평균 대비 차이 문구. */
export function deltaVsRegistered(score: number, bench: Benchmark = DEFAULT_BENCHMARK): string {
  const diff = score - bench.registered
  if (diff >= 0) return `등록 업체 평균과 동등 (+${diff}점)`
  return `등록 업체 평균 대비 ${-diff}점 낮음`
}
