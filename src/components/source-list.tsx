import type { Source } from '@/lib/types'

interface SourceListProps {
  sources: Source[]
}

export function SourceList({ sources }: SourceListProps) {
  return (
    <div className="mt-8 pt-6 border-t border-[#c1c1c1]">
      <h2 className="text-sm font-semibold text-[#222222] mb-2">참고 출처</h2>
      <ol className="list-decimal list-inside text-xs text-[#6a6a6a] space-y-1">
        {sources.map(source => (
          <li key={source.name}>
            {source.url ? (
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline text-[#008f6b]">
                {source.name}
              </a>
            ) : source.name}
            {source.year && ` (${source.year})`}
          </li>
        ))}
      </ol>
    </div>
  )
}
