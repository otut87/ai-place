// T-067 — Suspense 경계. DB 쿼리 완료 전 섀시를 먼저 렌더링.
export default function AdminPlacesLoading() {
  return (
    <div className="p-6">
      <div className="mb-4 h-6 w-32 animate-pulse rounded bg-[#eeeeee]" />
      <div className="mb-6 h-4 w-64 animate-pulse rounded bg-[#f3f4f6]" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-[#f3f4f6]" />
        ))}
      </div>
    </div>
  )
}
