import type { StatisticItem, Source } from '@/lib/types'

interface StatisticsBoxProps {
  statistics: StatisticItem[]
  sources: Source[]
  lastUpdated?: string
}

export function StatisticsBox({ statistics, sources, lastUpdated }: StatisticsBoxProps) {
  return (
    <div className="bg-[#f2f2f2] rounded-[14px] p-6">
      <h2 className="text-lg font-semibold text-[#222222] mb-4">주요 통계</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {statistics.map(stat => (
          <div key={stat.label} className="bg-white rounded-lg p-4">
            <p className="text-sm text-[#6a6a6a]">{stat.label}</p>
            <p className="text-xl font-bold text-[#00a67c] mt-1">{stat.value}</p>
            {stat.note && <p className="text-xs text-[#6a6a6a] mt-1">{stat.note}</p>}
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-[#c1c1c1]">
        <p className="text-xs text-[#6a6a6a]">
          출처: {sources.map((s, i) => (
            <span key={s.name}>
              {i > 0 && ', '}
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline text-[#008f6b]">
                  {s.name}
                </a>
              ) : s.name}
              {s.year && ` (${s.year})`}
            </span>
          ))}
        </p>
        {lastUpdated && (
          <p className="text-xs text-[#6a6a6a] mt-1">
            최종 업데이트: <time dateTime={lastUpdated}>{lastUpdated}</time>
          </p>
        )}
      </div>
    </div>
  )
}
