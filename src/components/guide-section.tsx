import type { GuideSection as GuideSectionType } from '@/lib/types'

interface GuideSectionProps {
  section: GuideSectionType
}

export function GuideSection({ section }: GuideSectionProps) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-[#222222] mb-3">{section.heading}</h2>
      <p className="text-base text-[#222222] leading-relaxed">{section.content}</p>
      {section.items && section.items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {section.items.map(item => (
            <li key={item} className="text-sm text-[#6a6a6a] flex items-start gap-2">
              <span className="text-[#00a67c] mt-0.5">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
