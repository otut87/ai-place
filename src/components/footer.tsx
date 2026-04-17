import Link from "next/link"

export function Footer() {
  return (
    <footer className="mt-16 bg-[#f2f2f2]">
      <div className="mx-auto max-w-[1200px] px-6 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {/* 도시 */}
          <div>
            <h3 className="text-sm font-semibold text-[#222222] mb-3">도시</h3>
            <ul className="space-y-2">
              <li><Link href="/cheonan/dermatology" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">천안</Link></li>
            </ul>
          </div>

          {/* 업종 */}
          <div>
            <h3 className="text-sm font-semibold text-[#222222] mb-3">업종</h3>
            <ul className="space-y-2">
              <li><Link href="/cheonan/dermatology" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">피부과</Link></li>
            </ul>
          </div>

          {/* 서비스 */}
          <div>
            <h3 className="text-sm font-semibold text-[#222222] mb-3">서비스</h3>
            <ul className="space-y-2">
              <li><Link href="/blog" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">블로그</Link></li>
              <li><Link href="/blog/cheonan/medical/cheonan-dermatology-guide" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">피부과 선택 가이드</Link></li>
              <li><Link href="/blog/cheonan/medical/cheonan-dermatology-acne-treatment" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">여드름 치료 비교</Link></li>
            </ul>
          </div>

          {/* AI Place */}
          <div>
            <h3 className="text-sm font-semibold text-[#222222] mb-3">AI Place</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">소개</Link></li>
              <li><Link href="/about" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">업체 등록 문의</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#c1c1c1]/50 space-y-1.5">
          <p className="text-xs text-[#6a6a6a]">
            &copy; {new Date().getFullYear()} AI Place. 기획·제작{' '}
            <a href="https://dedo.kr" target="_blank" rel="noopener noreferrer" className="hover:text-[#008f6b]">디두(dedo)</a>
          </p>
          <p className="text-[11px] text-[#6a6a6a]/70">
            사업자등록번호 742-21-00642 | 충남 천안시 서북구 쌍용11길 33 | support@dedo.kr
          </p>
        </div>
      </div>
    </footer>
  )
}
