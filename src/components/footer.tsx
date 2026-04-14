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
              <li><Link href="/cheonan" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">천안</Link></li>
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
              <li><Link href="/guide/cheonan/dermatology" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">피부과 선택 가이드</Link></li>
              <li><Link href="/compare/cheonan/dermatology/acne" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">여드름 치료 비교</Link></li>
            </ul>
          </div>

          {/* AI Place */}
          <div>
            <h3 className="text-sm font-semibold text-[#222222] mb-3">AI Place</h3>
            <ul className="space-y-2">
              <li><Link href="/admin/register" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">업체 등록</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#c1c1c1]/50">
          <p className="text-xs text-[#6a6a6a]">
            &copy; {new Date().getFullYear()} AI Place. AI가 추천하는 우리 동네 업체.
          </p>
        </div>
      </div>
    </footer>
  )
}
