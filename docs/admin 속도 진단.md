실제로 측정해보니 원인이 명확하게 보입니다. 아래는 /admin/places 새로고침 시 수집한 실측 데이터입니다.
측정 결과
페이지 로드 총 2,120ms, TTFB는 11ms로 매우 빠른데 DOM Ready가 1,858ms 가 걸립니다. 즉 서버 응답은 빠르고, 클라이언트 측 JS 실행과 RSC(React Server Components) prefetch가 시간을 다 잡아먹고 있는 구조입니다.
리소스도 33개밖에 안 되고 전송량도 가벼운데, 다음 4가지가 두드러집니다.
원인 1: RSC Prefetch 폭주 (가장 큰 범인)
/admin/register?_rsc=... 요청이 6번 반복됩니다(각 313~535ms). 이건 페이지 안의 <Link href="/admin/register"> 같은 Next.js Link 컴포넌트가 viewport에 들어오면 자동으로 RSC payload를 prefetch하는 기능 때문입니다. 같은 URL을 캐시 키 변경(_rsc 쿼리)으로 매번 새로 받고 있다는 것은 캐싱이 안 먹히고 있다는 뜻입니다. 6 × 평균 450ms = 2.7초 분량의 네트워크가 백그라운드에서 도는 거고, 메인 스레드도 같이 점유합니다.
해결책:

어드민의 <Link>에 prefetch={false} 명시 (어드민은 prefetch 이득보다 비용이 큽니다)
또는 Next.js experimental.staleTimes로 RSC 캐시 수명 설정
같은 화면에서 동일 링크가 여러 개라면 중복 제거

원인 2: Turbopack 빌드(개발 모드?) + 청크 11개
스크립트가 11개 청크로 쪼개져 있고 그중 turbopack-... 청크가 보입니다. 만약 프로덕션 배포에 dev 모드/turbopack이 섞여 있다면 그것만으로 3~10배 느려집니다. 배포 환경 확인이 필요합니다(Vercel이라면 Build Logs에서 next build 사용 여부, NODE_ENV=production 확인).
해결책:

next build && next start (또는 Vercel 정식 배포)인지 확인
배포된 페이지에서 process.env.NODE_ENV가 production인지 확인

원인 3: Pretendard 폰트 9개 woff2 동시 로드
pretendard-dynamic-subset 폰트가 79~91번 서브셋 9개를 jsdelivr CDN(해외)에서 로드합니다. 한국에서 접속 시 jsdelivr는 보통 200~400ms 걸리고, 폰트가 늦게 오면 FOIT/FOUT으로 체감 속도가 더 느려집니다.
해결책:

Next.js next/font/local로 Pretendard Variable을 셀프 호스팅 (Vercel/CDN 캐시)
또는 next/font/google이 지원하는 한글 대체 폰트(Noto Sans KR)로 어드민만 분리
preload는 1~2개 서브셋만, 나머지는 lazy

원인 4: 서버 컴포넌트가 동기적으로 DB를 기다림
/admin/places의 서버 응답은 11ms로 빠르지만, 그건 HTML shell만이고 실제 데이터는 RSC 스트리밍/Suspense로 따라옵니다. DOM Ready가 1.8초인 건 어드민의 Supabase/DB 쿼리가 직렬로 돌고 있을 가능성이 큽니다. 8개 fetch가 잡히는데 이게 모두 인증 체크 + places 목록 + 카운트 등을 따로따로 호출한다면 합산 지연이 큽니다.
해결책:

서버 컴포넌트에서 Promise.all로 병렬 fetch
DB 인덱스 점검 (places 테이블의 created_at, status, region_id 등)
React cache() 또는 unstable_cache로 동일 요청 메모이제이션
인증 체크를 미들웨어 레벨로 올려서 매 페이지에서 반복하지 않기

그 외 자잘한 이슈
Google Analytics 요청 2건이 503 에러를 반환합니다. 광고 차단 확장 때문일 수 있지만, 만약 GA 코드가 메인 번들에 동기 로드되어 있다면 timeout까지 메인 스레드를 잡습니다. next/script strategy="afterInteractive" 또는 lazyOnload로 분리하세요.

우선순위 액션 (효과 큰 순)
즉시(1일 안)

어드민 모든 <Link>에 prefetch={false} 적용 → 체감 속도 즉시 개선
배포가 production 빌드인지 확인 (turbopack 청크가 dev라면 critical)
GA를 next/script lazyOnload로 변경

단기(1주일)
4. Pretendard 셀프 호스팅 또는 어드민 폰트만 시스템 폰트로 전환
5. 서버 컴포넌트의 DB 호출 병렬화 + cache() 적용
중기
6. /admin/places 데이터 페칭을 페이지네이션 + 인덱스 최적화
7. 어드민 라우트에 loading.tsx Suspense 경계 추가해 첫 paint를 빠르게
가장 큰 단일 원인은 RSC prefetch 6번 반복입니다. 이거 하나만 막아도 백그라운드 네트워크가 거의 사라지고 메인 스레드 여유가 생겨서 체감 속도가 확 달라질 거예요. 먼저 그것부터 적용해보시고, 그래도 느리면 production 빌드 여부를 확인하는 순서를 추천합니다.