// T-173 — 가격 정책 페이지.
import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { composePageTitle } from '@/lib/seo/compose-title'

const TITLE = composePageTitle('요금 안내 — AI Place')
const DESC = 'AI Place 파일럿 30일 무료, 이후 월 9,900원. 프리미엄 GEO 컨설팅 100만원~. 명확한 기준·수치 증명.'

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

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {/* 파일럿 */}
            <div className="rounded-2xl border-2 border-emerald-400 bg-white p-6">
              <div className="mb-2 inline-block rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                파일럿
              </div>
              <div className="text-2xl font-bold text-[#191919]">30일 무료</div>
              <p className="text-xs text-[#6a6a6a]">가입 즉시 시작</p>
              <ul className="mt-4 space-y-2 text-sm text-[#484848]">
                <li>✓ AI Place 업체 페이지 자동 생성</li>
                <li>✓ JSON-LD · robots · sitemap · llms.txt 기본 탑재</li>
                <li>✓ 주 1회 실제 AI 인용 테스트</li>
                <li>✓ 월간 자동 리포트</li>
                <li>✓ AI 자동 입력 (월 5회, 주 1회)</li>
              </ul>
              <Link href="/signup" className="mt-6 block rounded-lg bg-emerald-600 py-2.5 text-center text-sm font-medium text-white hover:bg-emerald-700">
                무료로 시작
              </Link>
            </div>

            {/* 월 구독 */}
            <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6">
              <div className="mb-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                스탠다드
              </div>
              <div className="text-2xl font-bold text-[#191919]">월 9,900원</div>
              <p className="text-xs text-[#6a6a6a]">파일럿 종료 후 자동 전환</p>
              <ul className="mt-4 space-y-2 text-sm text-[#484848]">
                <li>✓ 파일럿 모든 기능 계속 이용</li>
                <li>✓ Owner 대시보드 · 점수 추이 차트</li>
                <li>✓ IndexNow 실시간 제출</li>
                <li>✓ AI 봇 방문 로그</li>
                <li>✓ 토스페이먼츠 자동 청구</li>
              </ul>
              <Link href="/signup" className="mt-6 block rounded-lg border border-[#191919] py-2.5 text-center text-sm font-medium text-[#191919] hover:bg-[#f0f0f0]">
                구독 시작
              </Link>
            </div>

            {/* 프리미엄 */}
            <div className="rounded-2xl border-2 border-[#191919] bg-white p-6">
              <div className="mb-2 inline-block rounded bg-[#191919] px-2 py-0.5 text-[10px] font-semibold text-white">
                프리미엄 컨설팅
              </div>
              <div className="text-2xl font-bold text-[#191919]">100만원~</div>
              <p className="text-xs text-[#6a6a6a]">1회 결제 · 기존 사이트 최적화</p>
              <ul className="mt-4 space-y-2 text-sm text-[#484848]">
                <li>✓ 초기 진단 리포트 (PDF)</li>
                <li>✓ 우선순위 매트릭스 + 수정 코드 제공</li>
                <li>✓ 직접 작업 or 작업 지시서</li>
                <li>✓ 작업 완료 후 재진단</li>
                <li>✓ <strong>점수 상승 증명서</strong> (ex. 58 → 91)</li>
              </ul>
              <a href="mailto:support@aiplace.kr?subject=프리미엄 컨설팅 문의" className="mt-6 block rounded-lg bg-[#191919] py-2.5 text-center text-sm font-medium text-white hover:bg-[#333]">
                문의하기
              </a>
            </div>
          </div>

          {/* FAQ */}
          <section className="mt-16">
            <h2 className="text-xl font-semibold text-[#191919]">자주 묻는 질문</h2>
            <div className="mt-6 space-y-4">
              <Faq q="파일럿 종료 후 자동 결제되나요?" a="네, 가입 시 등록한 카드로 30일 후 월 9,900원이 자동 결제됩니다. 만료 7일 전 리마인드 이메일을 보내드립니다. /owner/billing 에서 언제든 해지 가능합니다." />
              <Faq q="해지하면 내 업체 페이지는 어떻게 되나요?" a="구독 해지 시에도 업체 페이지는 읽기 전용으로 유지됩니다. 이미 공개된 페이지를 내리지 않습니다. 다만 대시보드·AI 테스트 등 부가 기능은 중단됩니다." />
              <Faq q="프리미엄 컨설팅은 무엇이 포함되나요?" a="(1) 초기 진단 리포트 PDF + 우선순위 매트릭스 (2) 수정 코드 스니펫 제공 (3) 이지수RC가 직접 작업 (옵션, 사이트 권한 필요) (4) 작업 후 재진단 실행 (5) 점수 상승 증명서. 범위에 따라 100~300만원입니다." />
              <Faq q="점수가 오르지 않으면 어떻게 되나요?" a="프리미엄 컨설팅은 최소 20점 이상 상승 보장입니다. 미달 시 차액 환불 또는 추가 작업 무상 제공 (계약서 명시)." />
              <Faq q="AI 자동 입력은 왜 월 5회 제한인가요?" a="업체당 월 5회면 충분한 수정 횟수이면서 비용 통제가 가능합니다 ($0.075/월). 주 1회 제한은 같은 날 여러 번 재생성하는 남용을 방지합니다. Admin 수동 증액 가능합니다." />
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
