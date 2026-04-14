#!/bin/bash
# AEO/GEO/SEO Checklist Hook
# Triggers after Write|Edit on src/app/**/page.tsx
# Based on docs/GEO-SEO-AEO-딥리서치.md

INPUT=$(cat /dev/stdin)

# Extract file_path without jq — grep JSON key
FILE_PATH=$(echo "$INPUT" | grep -oP '"file_path"\s*:\s*"\K[^"]+' 2>/dev/null)
if [ -z "$FILE_PATH" ]; then
  FILE_PATH=$(echo "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi

# Only trigger for page.tsx or layout.tsx in src/app/
if echo "$FILE_PATH" | grep -qE 'src[/\\]app[/\\].*page\.tsx$'; then
  RELATIVE_PATH=$(echo "$FILE_PATH" | sed 's|.*\(src[/\\]app[/\\]\)|\1|' | tr '\\' '/')

  cat <<CHECKLISTJSON
{
  "systemMessage": "AEO/GEO/SEO CHECKLIST for ${RELATIVE_PATH}\n(ref: docs/GEO-SEO-AEO-딥리서치.md)\n\n--- SEO (Layer 1) ---\n[ ] generateMetadata(): title, description(150자, 키워드 앞배치), OG\n[ ] H1 1개만, H2/H3 의미 구조 준수\n[ ] SSG: generateStaticParams() (AI 크롤러 JS 미실행 §5.5)\n[ ] sitemap.xml 엔트리 포함 확인\n[ ] 이미지: next/image + alt 텍스트\n[ ] robots: index, follow\n\n--- AEO (Layer 2) ---\n[ ] JSON-LD: 페이지 타입별 스키마 (LocalBusiness/Article/ItemList/WebSite)\n[ ] JSON-LD: FAQPage (2.7-3.2x 인용률 §4.3)\n[ ] JSON-LD: BreadcrumbList\n[ ] Direct Answer Block: H2 직하 40-60자 자기완결 답변 (§4.4)\n[ ] FAQ 섹션: 실제 검색어 형태 5개+ (§부록A)\n\n--- GEO (Layer 3) ---\n[ ] 통계/수치 3개+ (Princeton KDD 2024 §2.2 — +40% visibility)\n[ ] 출처 인용 2개+ (§2.2 Cite Sources)\n[ ] Last Updated: YYYY-MM-DD 타임스탬프 (§4.2 Freshness)\n[ ] safeJsonLd() 사용 (XSS 방지)\n[ ] 내부 링크: 관련 페이지 상호 연결\n\n--- 의료/로컬 추가 ---\n[ ] 의료광고법: 최고/최저가/1등 금지, 가격은 범위 표기\n[ ] sameAs: 네이버 플레이스, 카카오맵, GBP URL\n[ ] 전화번호/주소/영업시간 본문+스키마 일치 (§5.3)"
}
CHECKLISTJSON
  exit 0
fi

# Non-page files: no output
exit 0
