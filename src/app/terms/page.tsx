// 이용약관 — paper/orange aip 톤 (T-233 리스킨).
// 정식 약관은 법무 검토 후 채울 예정 (AUDIT P-13).

import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { HomeNav } from '@/app/_components/home/home-nav'
import { SiteFooter, SITE_BRAND } from '@/components/site/site-footer'
import { composePageTitle } from '@/lib/seo/compose-title'
import { MONTHLY_PRICE_LABEL } from '@/lib/pricing'
import '@/styles/aip.css'
import '@/styles/legal-page.css'

export const metadata: Metadata = {
  title: composePageTitle('이용약관 — AI Place'),
  alternates: { canonical: '/terms' },
  robots: { index: false, follow: true },
}

const EFFECTIVE_DATE = '2026-04-22'

export default function TermsPage() {
  return (
    <div className="aip-root legal-page">
      <HomeNav />
      <main>
        <div className="legal-wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">홈</Link>
            <span className="sep">/</span>
            <span className="cur">이용약관</span>
          </nav>

          <h1 className="title">
            <span className="it">이용</span>약관
          </h1>
          <p className="effective-date">
            시행일자 · <time dateTime={EFFECTIVE_DATE}>{EFFECTIVE_DATE}</time>
          </p>

          <Section title="제1조 (목적)">
            본 약관은 {SITE_BRAND.name} (이하 &ldquo;회사&rdquo;)가 제공하는 AI 검색 최적화 서비스(이하 &ldquo;서비스&rdquo;)의
            이용 조건 및 절차, 이용자와 회사의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.
          </Section>

          <Section title="제2조 (서비스 내용)">
            회사는 로컬 업체 디렉토리를 AI 검색에 최적화된 구조로 자동 생성하는 SaaS 를 제공합니다.
            등록된 업체 정보는 Schema.org 구조화 데이터·FAQ·비교 콘텐츠로 가공되며, 자사 도메인(aiplace.kr) 에서 발행됩니다.
          </Section>

          <Section title="제3조 (요금 및 결제)">
            파일럿 30일은 무료로 제공되며, 이후 {MONTHLY_PRICE_LABEL}(VAT 포함)이 카드 등록 시점부터 자동 청구됩니다.
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

          <p className="footnote">
            * 본 문서는 초안입니다. 정식 약관은 법무 검토 후 갱신됩니다. 문의:{' '}
            <a href={`mailto:${SITE_BRAND.email}`}>{SITE_BRAND.email}</a>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      <div className="body">{children}</div>
    </section>
  )
}
