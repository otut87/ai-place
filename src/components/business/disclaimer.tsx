// 업종별 면책 문구 (T-004)
// sector prop 받아 조건부 렌더. null 이면 아예 DOM 에 없음.

import { getDisclaimer } from '@/lib/constants/disclaimers'

export function Disclaimer({ sector, className }: { sector: string; className?: string }) {
  const text = getDisclaimer(sector)
  if (!text) return null
  return (
    <p className={className ?? 'mt-8 text-xs text-[#6a6a6a]'}>
      ※ {text}
    </p>
  )
}
