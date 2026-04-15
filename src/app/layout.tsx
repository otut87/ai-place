import type { Metadata } from "next"
import { Analytics } from "@/components/analytics"
import "./globals.css"

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
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans text-[#222222] bg-white">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
