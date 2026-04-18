export default function AdminReviewLoading() {
  return (
    <div className="flex h-[calc(100vh-3rem)]">
      <aside className="w-72 shrink-0 border-r border-[#e5e7eb] bg-white p-3">
        <div className="h-4 w-20 animate-pulse rounded bg-[#eeeeee]" />
        <ul className="mt-3 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="h-12 animate-pulse rounded bg-[#f3f4f6]" />
          ))}
        </ul>
      </aside>
      <section className="flex-1 p-6">
        <div className="h-6 w-40 animate-pulse rounded bg-[#eeeeee]" />
        <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded bg-[#f3f4f6]" />
          <div className="h-64 animate-pulse rounded bg-[#f3f4f6]" />
        </div>
      </section>
    </div>
  )
}
