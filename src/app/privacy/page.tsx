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

const EFFECTIVE_DATE = '2026-04-30'

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

          <Section title="4. 개인정보의 처리 위탁">
            회사는 서비스 제공을 위해 다음 위탁사에 개인정보 처리를 위탁합니다. 위탁사는 개인정보 보호 관련 법령을 준수하며,
            위탁된 정보는 위탁 목적 외 사용되지 않습니다.
            <ul>
              <li>토스페이먼츠 — 카드 빌링키 발급·자동 결제·영수증 발행</li>
              <li>Supabase Inc. (미국·EU) — 사용자 인증·데이터베이스, EU-US DPF 준수</li>
              <li>Vercel Inc. (미국) — 웹 호스팅·접근 로그</li>
              <li>Anthropic, Google, Naver — AI 콘텐츠 생성·외부 검색 API (이용자가 자발적으로 입력한 업체명·주소만 전달)</li>
              <li>Resend (미국) — 안내·결제 알림 이메일 발송</li>
              <li>Upstash (미국) — Rate-limit·세션 캐시</li>
            </ul>
          </Section>

          <Section title="5. 개인정보의 제3자 제공">
            회사는 이용자의 동의 없이 제3자에게 개인정보를 제공하지 않습니다. 단, 「개인정보 보호법」 제17조 제1항 제2호 및
            「전자상거래 등에서의 소비자보호에 관한 법률」 등 관계 법령에 따른 수사기관의 적법한 요청이 있는 경우 예외로 합니다.
          </Section>

          <Section title="6. 이용자의 권리">
            이용자는 언제든 자신의 개인정보를 열람·정정·삭제·처리 정지할 수 있으며, /owner 페이지에서 직접 관리하거나{' '}
            <a href={`mailto:${SITE_BRAND.email}`}>{SITE_BRAND.email}</a> 로 요청할 수 있습니다.
            만 14세 미만 아동의 개인정보는 수집하지 않습니다.
          </Section>

          <Section title="7. 개인정보의 안전성 확보 조치">
            <ul>
              <li>비밀번호 단방향 해시 (Supabase Auth 기본 암호화)</li>
              <li>개인정보 처리시스템 접근권한 관리·접속 기록 보관</li>
              <li>HTTPS 전송 암호화·DB 컬럼 단위 RLS(Row Level Security) 적용</li>
              <li>카드 정보는 토스페이먼츠 빌링키로 토큰화 — 회사 DB 에 카드번호 직접 저장 안 함</li>
            </ul>
          </Section>

          <Section title="8. 처리방침 변경">
            본 개인정보처리방침은 관련 법령 또는 서비스 변경에 따라 개정될 수 있습니다. 개정 시 시행 7일 전(중요 변경의
            경우 30일 전)까지 서비스 내 공지 또는 가입 이메일로 통지합니다.
          </Section>

          <Section title="9. 개인정보 보호 책임자">
            <ul>
              <li>책임자: {SITE_BRAND.publisher} 대표 이지수</li>
              <li>이메일: <a href={`mailto:${SITE_BRAND.email}`}>{SITE_BRAND.email}</a></li>
              <li>주소: {SITE_BRAND.address}</li>
              <li>사업자등록번호: {SITE_BRAND.bizRegNo}</li>
            </ul>
            개인정보 침해 신고·상담은 한국인터넷진흥원 개인정보침해신고센터(privacy.kisa.or.kr · 국번 없이 118),
            대검찰청 사이버범죄수사단(spo.go.kr · 02-3480-3573), 경찰청 사이버수사국(cyberbureau.police.go.kr · 국번 없이 182) 으로
            가능합니다.
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
