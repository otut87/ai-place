// 개인정보처리방침 스텁 — 정식 방침은 법무 검토 후 갱신 (AUDIT P-13)
import type { Metadata } from 'next'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { composePageTitle } from '@/lib/seo/compose-title'

export const metadata: Metadata = {
  title: composePageTitle('개인정보처리방침 — AI Place'),
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: true },
}

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-[#f7f7f7]">
        <section className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-2xl font-bold text-[#222222]">개인정보처리방침</h1>
          <p className="mt-2 text-xs text-[#6a6a6a]">시행일자: 2026-04-22</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-[#2a2a2a]">
            <Section title="1. 수집하는 개인정보 항목">
              <ul className="list-disc pl-5 space-y-1">
                <li>필수: 이메일, 비밀번호(해시 저장), 대표자 이름, 휴대폰 번호</li>
                <li>결제 시: 카드 빌링키(토스페이먼츠 발급, 카드번호 직접 저장 안 함)</li>
                <li>자동 수집: 접속 IP, 쿠키, User-Agent, 방문 경로</li>
              </ul>
            </Section>

            <Section title="2. 개인정보의 수집 및 이용 목적">
              <ul className="list-disc pl-5 space-y-1">
                <li>회원 가입 및 본인 확인, 서비스 제공·운영</li>
                <li>파일럿 종료 후 자동 결제 및 청구</li>
                <li>고객 지원 및 서비스 변경 안내</li>
                <li>마케팅 수신 동의자 대상 프로모션 발송 (선택)</li>
              </ul>
            </Section>

            <Section title="3. 개인정보의 보유 및 이용 기간">
              회원 탈퇴 시 지체 없이 파기합니다. 단, 관계 법령에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>계약 또는 청약철회 기록: 5년 (전자상거래법)</li>
                <li>대금결제 및 재화 공급 기록: 5년 (전자상거래법)</li>
                <li>로그인 기록: 3개월 (통신비밀보호법)</li>
              </ul>
            </Section>

            <Section title="4. 개인정보의 제3자 제공">
              회사는 이용자의 동의 없이 제3자에게 개인정보를 제공하지 않습니다. 단, 다음의 경우 예외로 합니다:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>토스페이먼츠 (결제 처리) — 카드 빌링키·청구 정보</li>
                <li>Supabase (데이터 저장·인증) — 전체 사용자 데이터, EU-US DPF 준수</li>
                <li>법령에 의거한 수사 기관의 요청</li>
              </ul>
            </Section>

            <Section title="5. 이용자의 권리">
              이용자는 언제든 자신의 개인정보를 열람·정정·삭제·처리 정지할 수 있으며, /owner 에서 직접 관리하거나
              support@aiplace.kr 로 요청할 수 있습니다.
            </Section>

            <Section title="6. 개인정보 보호 책임자">
              <ul className="list-disc pl-5 space-y-1">
                <li>책임자: 디두(dedo) 대표</li>
                <li>이메일: support@aiplace.kr</li>
                <li>주소: 충남 천안시 서북구 쌍용11길 33</li>
              </ul>
            </Section>
          </div>

          <p className="mt-12 text-xs text-[#6a6a6a]">
            * 본 문서는 초안입니다. 정식 방침은 법무 검토 후 갱신됩니다.
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
      <div className="mt-2 text-sm text-[#484848]">{children}</div>
    </section>
  )
}
