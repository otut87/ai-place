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

const EFFECTIVE_DATE = '2026-04-30'

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
            결제 수단은 토스페이먼츠를 통해 안전하게 보관되는 카드 빌링키로, 회사 서버는 카드번호를 직접 저장하지 않습니다.
            이용자는 /owner/billing/cancel 에서 언제든 해지할 수 있으며, 해지 시 잔여 결제 주기까지는 서비스가 유지됩니다.
          </Section>

          <Section title="제4조 (이용자의 의무)">
            이용자는 정확한 업체 정보를 제공할 의무가 있으며, 허위·과장·타 업체 비방 정보를 등록해서는 안 됩니다.
            의료·법률 등 규제 업종은 관련 법령 및 광고 규정을 준수해야 합니다.
          </Section>

          <Section title="제5조 (청약철회 및 환불)">
            「전자상거래 등에서의 소비자보호에 관한 법률」 에 따라 이용자는 결제일로부터 7일 이내 서비스를
            전혀 이용하지 않은 경우 청약철회가 가능합니다. 회사가 정한 30일 무료 파일럿 기간이 별도로 제공되므로,
            대부분의 경우 무료 파일럿 종료 전 해지로 환불 사유가 발생하지 않습니다.
            <br />
            이미 서비스가 제공·이용되어 콘텐츠 발행·자동 결제·외부 API 호출 등 비용이 발생한 경우 사용분에
            상응하는 금액은 환불 대상에서 제외될 수 있습니다. 환불 요청은{' '}
            <a href={`mailto:${SITE_BRAND.email}`}>{SITE_BRAND.email}</a> 로 가능하며, 통상 영업일 기준 7일 이내 처리됩니다.
          </Section>

          <Section title="제6조 (서비스 중단·해지)">
            회사는 천재지변·기술적 장애·정책 변경 등 불가피한 사유가 있을 경우 사전 고지 후 서비스를 중단할 수 있습니다.
            이용자의 약관 위반이 확인되면 사전 통지 후 계정을 정지할 수 있습니다. 회사가 임의로 서비스를 종료하는 경우
            잔여 결제 주기에 해당하는 금액을 일할 환불합니다.
          </Section>

          <Section title="제7조 (회사의 책임 한도)">
            회사는 AI 검색 노출·인용 결과를 보장하지 않습니다. AI 검색 엔진의 알고리즘·정책 변경,
            외부 데이터 소스(네이버·구글·카카오) 의 정책 변경 등 회사의 통제 범위를 벗어난 사유로 발생한
            손해에 대해서는 책임을 지지 않습니다. 회사의 고의·중과실로 인한 손해의 경우, 책임 범위는 직전
            12개월 결제 금액을 한도로 합니다.
          </Section>

          <Section title="제8조 (약관 변경)">
            회사는 관련 법령 변경 또는 서비스 개선이 필요한 경우 본 약관을 변경할 수 있습니다.
            변경 시 시행 7일 전(이용자에게 불리한 변경의 경우 30일 전)까지 서비스 내 공지 또는 가입
            이메일로 통지합니다. 변경 통지 후 이용자가 명시적으로 거부 의사를 표시하지 않고 계속 서비스를
            이용한 경우 변경 약관에 동의한 것으로 간주됩니다.
          </Section>

          <Section title="제9조 (준거법 및 관할)">
            본 약관은 대한민국 법률에 따라 해석되며, 분쟁 발생 시 회사 본점 소재지 관할 법원을 제1심 관할 법원으로 합니다.
            소비자분쟁해결 기준은 「소비자기본법」 시행령 별표 2 의 일반 기준에 따릅니다.
          </Section>

          <Section title="제10조 (사업자 정보)">
            <ul>
              <li>상호: {SITE_BRAND.publisher}</li>
              <li>서비스명: {SITE_BRAND.name}</li>
              <li>대표자: 이지수</li>
              <li>사업자등록번호: {SITE_BRAND.bizRegNo}</li>
              <li>주소: {SITE_BRAND.address}</li>
              <li>고객지원: <a href={`mailto:${SITE_BRAND.email}`}>{SITE_BRAND.email}</a></li>
              <li>호스팅 제공자: Vercel Inc.</li>
              <li>
                통신판매업 신고: 서비스 본격 운영 시점에 관할 시·군·구청에 신고 예정
                (현재는 「전자상거래 등에서의 소비자보호에 관한 법률」 시행령 제16조의 신고 의무 면제 기준 이내)
              </li>
            </ul>
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
