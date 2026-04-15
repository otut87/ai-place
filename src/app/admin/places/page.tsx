import { requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlaceActions } from './place-actions'

export default async function AdminPlacesPage() {
  await requireAuth()

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('places')
    .select('id, slug, name, city, category, status, rating, review_count, created_at')
    .order('created_at', { ascending: false })

  const places = data as Array<{
    id: string; slug: string; name: string; city: string; category: string;
    status: string; rating: number | null; review_count: number | null; created_at: string;
  }> | null

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[#222222]">업체 목록</h1>
        <Link href="/admin/register" className="h-10 px-4 inline-flex items-center rounded-lg bg-[#222222] text-white text-sm font-medium">
          새 업체 등록
        </Link>
      </div>

      {(!places || places.length === 0) ? (
        <p className="text-[#6a6a6a]">등록된 업체가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {places.map((place) => (
            <div key={place.id} className="flex items-center justify-between p-4 rounded-xl border border-[#dddddd] bg-white">
              <div>
                <p className="font-medium text-[#222222]">{place.name}</p>
                <p className="text-sm text-[#6a6a6a]">
                  {place.city} · {place.category}
                  {place.rating != null && ` · ★ ${place.rating}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  place.status === 'active' ? 'bg-green-100 text-green-700' :
                  place.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {place.status}
                </span>
                <PlaceActions placeId={place.id} status={place.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
