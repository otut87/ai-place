import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function RegisterPage() {
  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-6">🚧</div>
          <h1 className="text-[28px] font-bold text-[#222222]">업체 등록 준비 중</h1>
          <p className="mt-4 text-base text-[#6a6a6a] leading-relaxed">
            업체 등록 기능을 준비하고 있습니다. 등록을 원하시면 아래 이메일로 연락해주세요.
          </p>
          <p className="mt-4 text-base font-medium text-[#00a67c]">contact@aiplace.kr</p>
          <Link
            href="/"
            className="mt-8 inline-flex h-12 px-6 items-center rounded-lg bg-[#222222] text-white font-medium hover:bg-[#333333] transition-colors"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
