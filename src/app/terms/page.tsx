// 이용약관 스텁 — 정식 약관은 법무 검토 후 채울 예정 (AUDIT P-13)
import type { Metadata } from 'next'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { composePageTitle } from '@/lib/seo/compose-title'

export const metadata: Metadata = {
  title: composePageTitle('이용약관 — AI Place'),
  alternates: { canonical: '/terms' },
  robots: { index: false, follow: true },
}

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-[#f7f7f7]">
        <section className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-2xl font-bold text-[#222222]">이용약관</h1>
          <p className="mt-2 text-xs text-[#6a6a6a]">시행일자: 2026-04-22</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-[#2a2a2a]">
            <Section title="제1조 (목적)">
              본 약관은 AI Place (이하 &ldquo;회사&rdquo;)가 제공하는 AI 검색 최적화 서비스(이하 &ldquo;서비스&rdquo;)의
              이용 조건 및 절차, 이용자와 회사의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.
            </Section>

            <Section title="제2조 (서비스 내용)">
              회사는 로컬 업체 디렉토리를 AI 검색에 최적화된 구조로 자동 생성하는 SaaS 를 제공합니다.
              등록된 업체 정보는 Schema.org 구조화 데이터·FAQ·비교 콘텐츠로 가공되며, 자사 도메인(aiplace.kr) 에서 발행됩니다.
            </Section>

            <Section title="제3조 (요금 및 결제)">
              파일럿 30일은 무료로 제공되며, 이후 월 14,900원(VAT 포함)이 카드 등록 시점부터 자동 청구됩니다.
              이용자는 /owner/billing/cancel 에서 언제든 해지할 수 있으며, 해지 시 잔여 기간까지는 서비스가 유지됩니다.
            </Section>

            <Section title="제4조 (이용자의 의무)">
              이용자는 정확한 업체 정보를 제공할 의무가 있으며, 허위·과장·타 업체 비방 정보를 등록해서는 안 됩니다.
              의료·법률 등 규제 업종은 관련 법령 및 광고 규정을 준수해야 합니다.
            </Section>

            <Section title="제5조 (서비스 중단·해지)">
              회사는 천재지변·기술적 장애·정책 변경 등 불가피한 사유가 있을 경우 사전 고지 후 서비스를 중단할 수 있습니다.
              이용자의 약관 위반이 확인되면 사전 통지 후 계정을 정지할 수 있습니다.
            </Section>

            <Section title="제6조 (준거법 및 관할)">
              본 약관은 대한민국 법률에 따라 해석되며, 분쟁 발생 시 회사 본점 소재지 관할 법원을 제1심 관할 법원으로 합니다.
            </Section>
          </div>

          <p className="mt-12 text-xs text-[#6a6a6a]">
            * 본 문서는 초안입니다. 정식 약관은 법무 검토 후 갱신됩니다. 문의: support@aiplace.kr
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-[#191919]">{title}</h2>
      <p className="mt-2 text-sm text-[#484848]">{children}</p>
    </section>
  )
}
