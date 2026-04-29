// 개인정보처리방침 — paper/orange aip 톤 (T-233 리스킨).
// 정식 방침은 법무 검토 후 갱신 (AUDIT P-13).

import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { HomeNav } from '@/app/_components/home/home-nav'
import { SiteFooter, SITE_BRAND } from '@/components/site/site-footer'
import { composePageTitle } from '@/lib/seo/compose-title'
import '@/styles/aip.css'
import '@/styles/legal-page.css'

export const metadata: Metadata = {
  title: composePageTitle('개인정보처리방침 — AI Place'),
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: true },
}

const EFFECTIVE_DATE = '2026-04-22'

export default function PrivacyPage() {
  return (
    <div className="aip-root legal-page">
      <HomeNav />
      <main>
        <div className="legal-wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">홈</Link>
            <span className="sep">/</span>
            <span className="cur">개인정보처리방침</span>
          </nav>

          <h1 className="title">
            개인정보 <span className="it">처리방침</span>
          </h1>
          <p className="effective-date">
            시행일자 · <time dateTime={EFFECTIVE_DATE}>{EFFECTIVE_DATE}</time>
          </p>

          <Section title="1. 수집하는 개인정보 항목">
            <ul>
              <li>필수: 이메일, 비밀번호(해시 저장), 대표자 이름, 휴대폰 번호</li>
              <li>결제 시: 카드 빌링키(토스페이먼츠 발급, 카드번호 직접 저장 안 함)</li>
              <li>자동 수집: 접속 IP, 쿠키, User-Agent, 방문 경로</li>
            </ul>
          </Section>

          <Section title="1-1. 익명 진단(/check) 데이터">
            로그인 없이 사용 가능한 사이트 진단 페이지(<code>/check</code>)에서는 다음 항목만 저장합니다:
            <ul>
              <li>도메인 + 경로 (예: <code>https://example.com/about</code>) — <strong>쿼리 문자열·해시·토큰 제거 후 저장</strong></li>
              <li>진단 점수와 항목별 통과/실패 상태 (개인 식별 불가)</li>
              <li>User-Agent 200자 이내 (악용 추적용, 단독으론 식별 불가)</li>
            </ul>
            저장하지 않는 것: 사용자 IP, 로그인 세션, URL 쿼리·토큰·이메일·내부 식별자. 개인이 식별될 수 있는 정보가 포함되지 않으므로 「개인정보 보호법」상 개인정보에 해당하지 않습니다.
          </Section>

          <Section title="2. 개인정보의 수집 및 이용 목적">
            <ul>
              <li>회원 가입 및 본인 확인, 서비스 제공·운영</li>
              <li>파일럿 종료 후 자동 결제 및 청구</li>
              <li>고객 지원 및 서비스 변경 안내</li>
              <li>마케팅 수신 동의자 대상 프로모션 발송 (선택)</li>
            </ul>
          </Section>

          <Section title="3. 개인정보의 보유 및 이용 기간">
            회원 탈퇴 시 지체 없이 파기합니다. 단, 관계 법령에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다:
            <ul>
              <li>계약 또는 청약철회 기록: 5년 (전자상거래법)</li>
              <li>대금결제 및 재화 공급 기록: 5년 (전자상거래법)</li>
              <li>로그인 기록: 3개월 (통신비밀보호법)</li>
            </ul>
          </Section>

          <Section title="4. 개인정보의 제3자 제공">
            회사는 이용자의 동의 없이 제3자에게 개인정보를 제공하지 않습니다. 단, 다음의 경우 예외로 합니다:
            <ul>
              <li>토스페이먼츠 (결제 처리) — 카드 빌링키·청구 정보</li>
              <li>Supabase (데이터 저장·인증) — 전체 사용자 데이터, EU-US DPF 준수</li>
              <li>법령에 의거한 수사 기관의 요청</li>
            </ul>
          </Section>

          <Section title="5. 이용자의 권리">
            이용자는 언제든 자신의 개인정보를 열람·정정·삭제·처리 정지할 수 있으며, /owner 에서 직접 관리하거나{' '}
            <a href={`mailto:${SITE_BRAND.email}`}>{SITE_BRAND.email}</a> 로 요청할 수 있습니다.
          </Section>

          <Section title="6. 개인정보 보호 책임자">
            <ul>
              <li>책임자: {SITE_BRAND.publisher} 대표</li>
              <li>이메일: {SITE_BRAND.email}</li>
              <li>주소: {SITE_BRAND.address}</li>
            </ul>
          </Section>

          <p className="footnote">* 본 문서는 초안입니다. 정식 방침은 법무 검토 후 갱신됩니다.</p>
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
