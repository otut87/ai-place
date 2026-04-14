import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PlaceCard } from "@/components/place-card"
import { getCities, getCategories, getPlaces } from "@/lib/data"
import { safeJsonLd } from "@/lib/utils"

export default async function HomePage() {
  const cities = await getCities()
  const categories = await getCategories()
  const recentPlaces = await getPlaces("cheonan", "dermatology")

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AI Place",
    url: "https://ai-place.vercel.app",
    description: "AI가 추천하는 로컬 업체 디렉토리",
  }

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="pt-24 pb-20 px-6">
          <div className="mx-auto max-w-[1200px] text-center">
            <h1 className="text-[28px] sm:text-[36px] font-bold text-[#222222] leading-tight tracking-tight">
              AI가 추천하는 우리 동네 업체
            </h1>
            <p className="mt-4 text-base text-[#6a6a6a] max-w-md mx-auto">
              ChatGPT, Claude에서 검색되는 병원, 미용실, 인테리어를 찾아보세요
            </p>
          </div>
        </section>

        {/* Popular Cities */}
        <section className="py-20 px-6">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[28px] font-bold text-[#222222] leading-[1.43]">인기 도시</h2>
            <div className="mt-10 flex flex-wrap gap-3">
              {cities.map(city => (
                <Link
                  key={city.slug}
                  href={`/${city.slug}`}
                  className="px-5 py-2.5 text-sm font-medium text-[#222222] border border-[#c1c1c1] rounded-lg hover:bg-[#f2f2f2] transition-colors"
                >
                  {city.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Popular Categories */}
        <section className="py-20 px-6 bg-[#f2f2f2]">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[28px] font-bold text-[#222222] leading-[1.43]">인기 업종</h2>
            <div className="mt-10 flex flex-wrap gap-3">
              {categories.map(cat => (
                <Link
                  key={cat.slug}
                  href={`/cheonan/${cat.slug}`}
                  className="px-5 py-2.5 text-sm font-medium text-[#222222] bg-white border border-[#c1c1c1] rounded-lg hover:bg-[#f2f2f2] transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Recent Places */}
        <section className="py-20 px-6">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[28px] font-bold text-[#222222] leading-[1.43]">최근 등록 업체</h2>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {recentPlaces.slice(0, 4).map(place => (
                <PlaceCard key={place.slug} place={place} />
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 px-6 bg-[#f2f2f2]">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[28px] font-bold text-[#222222] leading-[1.43]">AI Place가 뭔가요?</h2>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="bg-white rounded-[20px] p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="text-2xl font-bold text-[#00a67c] mb-3">1</div>
                <h3 className="text-lg font-semibold text-[#222222] mb-2">업체 등록</h3>
                <p className="text-sm text-[#6a6a6a]">5분이면 끝. 기본 정보만 입력하세요.</p>
              </div>
              <div className="bg-white rounded-[20px] p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="text-2xl font-bold text-[#00a67c] mb-3">2</div>
                <h3 className="text-lg font-semibold text-[#222222] mb-2">AI 최적화 프로필 생성</h3>
                <p className="text-sm text-[#6a6a6a]">구조화 데이터, FAQ, 비교 콘텐츠를 자동으로 만들어드립니다.</p>
              </div>
              <div className="bg-white rounded-[20px] p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="text-2xl font-bold text-[#00a67c] mb-3">3</div>
                <h3 className="text-lg font-semibold text-[#222222] mb-2">AI에서 추천 시작</h3>
                <p className="text-sm text-[#6a6a6a]">ChatGPT, Claude, Gemini가 당신의 업체를 추천합니다.</p>
              </div>
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/admin/register"
                className="inline-flex h-12 px-6 items-center rounded-lg bg-[#00a67c] text-white font-medium hover:bg-[#008f6b] transition-colors"
              >
                무료 등록하기
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(orgJsonLd) }}
      />
    </>
  )
}
