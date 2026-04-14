import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"

const pretendard = localFont({
  src: [
    {
      path: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
      style: "normal",
    },
  ],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "AI Place — AI가 추천하는 우리 동네 업체",
    template: "%s | AI Place",
  },
  description:
    "ChatGPT, Claude, Gemini에서 추천되는 로컬 업체를 찾아보세요. 피부과, 치과, 미용실, 인테리어 등.",
  metadataBase: new URL("https://ai-place.vercel.app"),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "AI Place",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans text-[#222222] bg-white">
        {children}
      </body>
    </html>
  )
}
