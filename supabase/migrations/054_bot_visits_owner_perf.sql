-- 054: T-265 — owner 대시보드 추가 perf fix
--
-- 053 일별 사전집계 후에도 /owner 가 수십초 hang. 두 병목 확인:
--
-- 1) bot_visits.path 인덱스 부재 (024 마이그레이션). idx_bot_visits_visited_desc 만 있어
--    listOwnerBotVisits 의 `path IN (수천) + visited_at` 쿼리가 visited_at 인덱스 seek 후
--    path 비인덱스 필터로 30개 찾기 위해 수만 rows 스캔. → composite (path, visited_at desc).
--
-- 2) bot_visits_daily_owner SELECT 페이지네이션이 PostgREST 1000-row cap 우회 5+ 라운드.
--    owner places × 27 bots × 5 pageType × 30일 = 최대 20K rows → 21+ round trip.
--    → SQL RPC 한 번에 결과 반환 (max_rows 영향 없음).

-- ── 1. bot_visits composite 인덱스 ────────────────────────────────────
-- IF NOT EXISTS — 이미 존재하면 idempotent. CREATE INDEX CONCURRENTLY 는 트랜잭션 안에서
-- 실행 안 되므로 일반 CREATE INDEX 사용. 1.17M rows 위에서 ~10~30초 lock (Supabase
-- migration 적용 시점에 짧은 write 차단).
CREATE INDEX IF NOT EXISTS idx_bot_visits_path_visited
  ON bot_visits(path, visited_at DESC);

-- ── 2. owner snapshot RPC — 페이지네이션 제거 ──────────────────────────
-- 053 의 fetchOwnerDailySnapshot 페이지네이션을 한 번 RPC 호출로 대체.
-- RPC 는 PostgREST max_rows cap 영향 없음 — 모든 row 1회 반환.
CREATE OR REPLACE FUNCTION public.owner_bot_visits_daily_select(
  p_place_ids uuid[],
  p_from_date date,
  p_to_date   date
)
RETURNS TABLE (
  date            date,
  place_id        uuid,
  bot_id          text,
  page_type       text,
  visits          int,
  last_visited_at timestamptz
)
LANGUAGE sql STABLE AS $$
  SELECT date, place_id, bot_id, page_type, visits, last_visited_at
  FROM bot_visits_daily_owner
  WHERE place_id = ANY(p_place_ids)
    AND date >= p_from_date
    AND date <= p_to_date;
$$;

-- ── 3. listOwnerBotVisits 용 RPC — INNER JOIN server-side ─────────────
-- 기존 코드: paths IN (수천) + visited_at + .order().limit(30) 가 raw 1.17M 위에서 느림.
-- RPC 는 (1) 인덱스 활용 + (2) paths IN 큰 배열을 SQL 클라이언트 → 서버 전송 비용 회피
-- (place_id ANY 로 받아 server-side 에서 place_mentions JOIN).
CREATE OR REPLACE FUNCTION public.owner_recent_bot_visits(
  p_place_ids uuid[],
  p_limit     int,
  p_from      timestamptz,
  p_to        timestamptz
)
RETURNS TABLE (
  id         bigint,
  bot_id     text,
  path       text,
  visited_at timestamptz,
  page_type  text,
  place_id   uuid
)
LANGUAGE sql STABLE AS $$
  SELECT bv.id, bv.bot_id, bv.path, bv.visited_at, pm.page_type, pm.place_id
  FROM bot_visits bv
  INNER JOIN place_mentions pm ON pm.page_path = bv.path
  WHERE bv.visited_at >= p_from
    AND bv.visited_at <  p_to
    AND pm.place_id = ANY(p_place_ids)
  ORDER BY bv.visited_at DESC
  LIMIT p_limit;
$$;
