// T-173 — 가격 정책 페이지.
import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { composePageTitle } from '@/lib/seo/compose-title'

const TITLE = composePageTitle('요금 안내 — AI Place')
const DESC = 'AI Place 파일럿 30일 무료, 이후 월 14,900원 단일 플랜. 월 블로그 5편 + 월간 리포트 + AEO 점검 포함. 프리미엄 GEO 컨설팅 별도.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: '/pricing' },
  openGraph: { title: TITLE, description: DESC, url: '/pricing' },
}

export default function PricingPage() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-[#f7f7f7]">
        <section className="mx-auto max-w-5xl px-6 py-16">
          <h1 className="text-3xl font-bold text-[#191919]">요금 안내</h1>
          <p className="mt-3 text-base text-[#484848]">
            AI 검색(ChatGPT·Claude·Gemini)에 내 업체가 노출되도록 구조화합니다.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {/* 단일 구독 플랜 (T-205) */}
            <div className="rounded-2xl border-2 border-[#191919] bg-white p-7">
              <div className="mb-2 inline-block rounded bg-[#191919] px-2 py-0.5 text-[10px] font-semibold text-white">
                AI Place · 단일 플랜
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#191919]">월 14,900원</span>
                <span className="text-xs text-[#6a6a6a]">(첫 30일 무료)</span>
              </div>
              <p className="mt-2 text-sm text-[#484848]">
                업체 1곳 · 월 블로그 5편 자동 발행 · AEO 점검 · 월간 리포트. 단일 요금제로 단순화.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#484848]">
                <li>✓ AI Place 업체 페이지 자동 생성 (JSON-LD · AEO 최적화)</li>
                <li>✓ <strong>월 5편 블로그 자동 발행</strong> — 내 업체 중심 (업체상세·비교·가이드·키워드 로테이션)</li>
                <li>✓ 오너 대시보드 — AI 봇 방문 실측 · 직접/언급 귀속 · AEO 8룰 점수</li>
                <li>✓ <strong>월간 PDF 리포트</strong> — 모든 구독자 공통 제공</li>
                <li>✓ 주 1회 실제 AI 인용 테스트 (GPT · Claude · Perplexity)</li>
                <li>✓ IndexNow 실시간 제출 · robots/sitemap/llms.txt 탑재</li>
                <li>✓ 언제든 해지 · 해지해도 업체 페이지는 읽기 전용으로 유지</li>
              </ul>
              <Link href="/signup" className="mt-6 block rounded-lg bg-[#191919] py-3 text-center text-sm font-semibold text-white hover:bg-[#333]">
                30일 무료로 시작 →
              </Link>
              <p className="mt-3 text-[11px] text-[#8a8a8a] text-center">
                토스페이먼츠 자동 청구 · 30일 경과 후 결제 · 파일럿 종료 7일 전 알림
              </p>
            </div>

            {/* 프리미엄 컨설팅 (별도 세일즈 라인) */}
            <div className="rounded-2xl border border-[#e5e7eb] bg-white p-7">
              <div className="mb-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                프리미엄 컨설팅 (별도)
              </div>
              <div className="mt-2 text-3xl font-bold text-[#191919]">100만원~</div>
              <p className="text-xs text-[#6a6a6a]">1회 결제 · 기존 사이트·네이버 플레이스 최적화</p>
              <p className="mt-2 text-sm text-[#484848]">
                병원·다점포·프랜차이즈 대상. 사장님이 자체 사이트를 갖고 있어 직접 AEO 개선을 의뢰하고 싶을 때.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#484848]">
                <li>✓ 초기 진단 리포트 (PDF)</li>
                <li>✓ 우선순위 매트릭스 + 수정 코드 제공</li>
                <li>✓ 직접 작업 또는 작업 지시서 선택</li>
                <li>✓ 작업 완료 후 재진단 실행</li>
                <li>✓ <strong>점수 상승 증명서</strong> (예: 58 → 91)</li>
                <li>✓ <strong>최소 20점 상승 보장</strong> · 미달 시 차액 환불</li>
              </ul>
              <a
                href="mailto:support@aiplace.kr?subject=프리미엄 컨설팅 문의"
                className="mt-6 block rounded-lg border border-[#191919] py-3 text-center text-sm font-semibold text-[#191919] hover:bg-[#f0f0f0]"
              >
                문의하기 →
              </a>
              <p className="mt-3 text-[11px] text-[#8a8a8a] text-center">
                월 구독과 독립적 · 범위에 따라 100~300만원
              </p>
            </div>
          </div>

          {/* FAQ */}
          <section className="mt-16">
            <h2 className="text-xl font-semibold text-[#191919]">자주 묻는 질문</h2>
            <div className="mt-6 space-y-4">
              <Faq q="월 14,900원에 포함되는 블로그는 몇 편인가요?" a="업체 1곳당 월 5편이 자동 발행됩니다. 업체상세 2편 + 비교 1편 + 가이드 1편 + 키워드 1편 로테이션으로, 같은 업체 내에서 내용이 중복되지 않도록 similarity-guard 가 차단합니다. 파일럿 30일 기간에도 동일하게 제공됩니다." />
              <Faq q="파일럿 종료 후 자동 결제되나요?" a="네, 가입 시 등록한 카드로 30일 후 월 14,900원이 자동 결제됩니다. 만료 7일 전 리마인드 이메일을 보내드립니다. /owner/billing 에서 언제든 해지 가능합니다." />
              <Faq q="월간 리포트는 어떻게 받나요?" a="매월 1일 오전 9시(KST) 에 지난 달 실측 리포트를 가입 이메일로 발송합니다. AI 봇 방문 횟수·엔진별 인용 추이·AEO 점수 변화·할 일 체크리스트가 PDF로 포함됩니다. 구독자 전원 공통 제공입니다." />
              <Faq q="해지하면 내 업체 페이지는 어떻게 되나요?" a="구독 해지 시에도 업체 페이지는 읽기 전용으로 유지됩니다. 이미 공개된 페이지를 내리지 않습니다. 다만 대시보드·AI 테스트·블로그 자동 발행 등 부가 기능은 중단됩니다." />
              <Faq q="프리미엄 컨설팅은 월 구독과 별도인가요?" a="네, 완전히 독립적입니다. 컨설팅은 1회 결제 100~300만원이며, 기존 사이트나 네이버 플레이스를 갖고 있는 사장님이 자체 채널 AEO 개선을 의뢰하는 서비스입니다. 월 구독은 AI Place 자체 플랫폼 노출입니다." />
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="rounded-xl border border-[#e5e7eb] bg-white p-4">
      <summary className="cursor-pointer text-sm font-medium text-[#191919]">{q}</summary>
      <p className="mt-2 text-sm leading-relaxed text-[#484848]">{a}</p>
    </details>
  )
}
