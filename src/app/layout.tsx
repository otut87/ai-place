import type { Metadata } from "next"
import localFont from "next/font/local"
import { Instrument_Serif, JetBrains_Mono } from "next/font/google"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@/components/analytics"
import "./globals.css"

// T-036: Pretendard self-host (next/font/local 이 자동 woff2 preload + font-display:swap 설정)
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  variable: "--font-pretendard",
  weight: "45 920",
  preload: true,
})

// aip.css 의 --serif / --mono 토큰에 연결될 Google 폰트. App Router 권장 패턴:
// <link> 태그 대신 next/font 로 로드하여 자동 self-host + preload.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "AI Place — AI가 추천하는 우리 동네 업체",
    template: "%s | AI Place",
  },
  description:
    "ChatGPT, Claude, Gemini에서 추천되는 로컬 업체를 찾아보세요. 피부과, 치과, 미용실, 인테리어 등.",
  metadataBase: new URL("https://aiplace.kr"),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "AI Place",
    title: "AI Place — AI가 추천하는 우리 동네 업체",
    description:
      "ChatGPT, Claude, Gemini에서 추천되는 로컬 업체를 찾아보세요. 피부과, 치과, 미용실, 인테리어 등.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Place — AI가 추천하는 우리 동네 업체",
    description:
      "ChatGPT, Claude, Gemini에서 추천되는 로컬 업체를 찾아보세요.",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "5ew7ZO8IHVZbSw1H8z3JrlqJTxECjalQ9ME944V88fE",
    other: {
      "naver-site-verification": "3fc34d317afb03f00b61668570ab9b7dda278426",
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={`h-full antialiased ${pretendard.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-full flex flex-col font-sans text-[#222222] bg-white">
        {children}
        <Analytics />
        {/* T-039 CWV: Vercel Speed Insights — LCP/CLS/INP 실측 수집 */}
        <SpeedInsights />
      </body>
    </html>
  )
}
