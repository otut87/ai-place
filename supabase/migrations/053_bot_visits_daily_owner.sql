-- 053: owner-side 일별 사전집계 (T-264)
--
-- 배경: 051 마이그레이션이 admin/seo 의 bot_visits 1.17M 페이지네이션 hang 을 해결했지만
-- /owner 대시보드는 같은 raw 테이블을 paths IN + 30일 윈도우 페이지네이션 5+ 라운드로
-- 여전히 hit. owner 의 통계는 path → place_id 매핑 (place_mentions) 까지 적용해야 하므로
-- 051 의 path-only 사전집계로는 부족.
--
-- 영구 해결: 매일 KST 00:10 에 bot_visits ⨝ place_mentions 결과를 place_id × bot_id ×
-- page_type 으로 사전집계. owner UI 는 어제까지 = 사전집계 SELECT (place_id IN) + 오늘 =
-- 라이브 RPC 합쳐서 <100ms 안에 로드. raw bot_visits 보존 윈도우(052 의 30일)와 무관.
--
-- 매핑 변경 정책: 새 place_mentions 가 추가되면 그 일자 이후부터만 반영. 과거 일자는
-- 그 시점의 매핑으로 동결 (정합성·재현성). 새 owner 는 과거 통계 의미 없음 → 영향 없음.

-- ── 1. owner-attribution 일별 집계 테이블 ─────────────────────────────
-- 한 path 가 여러 place_id 에 매핑되면 visits 가 자연스럽게 fan-out (별도 분배 없음).
-- page_type 은 place_mentions 와 동일 enum: 'detail'|'blog'|'compare'|'guide'|'keyword'.
CREATE TABLE IF NOT EXISTS bot_visits_daily_owner (
  date            date NOT NULL,
  place_id        uuid NOT NULL,
  bot_id          text NOT NULL,
  page_type       text NOT NULL,
  visits          int  NOT NULL,
  last_visited_at timestamptz,
  PRIMARY KEY (date, place_id, bot_id, page_type)
);

-- owner UI 의 핵심 쿼리: place_id IN (...) + date BETWEEN ...
CREATE INDEX IF NOT EXISTS idx_bvdo_place_date ON bot_visits_daily_owner(place_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_bvdo_date       ON bot_visits_daily_owner(date DESC);

ALTER TABLE bot_visits_daily_owner ENABLE ROW LEVEL SECURITY;

-- ── 2. 특정 일자 집계 함수 (idempotent) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.aggregate_bot_visits_daily_owner_for(p_date date)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_start timestamptz;
  v_end   timestamptz;
BEGIN
  v_start := (p_date::text || ' 00:00:00')::timestamp AT TIME ZONE 'Asia/Seoul';
  v_end   := ((p_date + 1)::text || ' 00:00:00')::timestamp AT TIME ZONE 'Asia/Seoul';

  INSERT INTO bot_visits_daily_owner (date, place_id, bot_id, page_type, visits, last_visited_at)
  SELECT
    p_date,
    pm.place_id,
    bv.bot_id,
    pm.page_type,
    count(*)::int,
    max(bv.visited_at)
  FROM bot_visits bv
  INNER JOIN place_mentions pm ON pm.page_path = bv.path
  WHERE bv.visited_at >= v_start
    AND bv.visited_at <  v_end
  GROUP BY pm.place_id, bv.bot_id, pm.page_type
  ON CONFLICT (date, place_id, bot_id, page_type) DO UPDATE SET
    visits          = EXCLUDED.visits,
    last_visited_at = EXCLUDED.last_visited_at;
END;
$$;

-- ── 3. cron wrapper (어제 KST 일자) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.aggregate_bot_visits_daily_owner()
RETURNS void LANGUAGE sql AS $$
  SELECT public.aggregate_bot_visits_daily_owner_for(((now() AT TIME ZONE 'Asia/Seoul')::date - 1));
$$;

-- ── 4. backfill helper ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.backfill_bot_visits_daily_owner(p_days int)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  d       date;
  v_end   date;
  v_start date;
  cnt     int := 0;
BEGIN
  v_end   := (now() AT TIME ZONE 'Asia/Seoul')::date - 1;
  v_start := v_end - (p_days - 1);
  FOR d IN SELECT generate_series(v_start, v_end, '1 day'::interval)::date LOOP
    PERFORM public.aggregate_bot_visits_daily_owner_for(d);
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END;
$$;

-- ── 5. 오늘 라이브 RPC (place_id 셋 기준) ──────────────────────────────
-- owner UI 는 어제까지 SELECT + 오늘 이 RPC 한 번 = 두 결과 merge.
-- raw bot_visits 1일치 ~39K rows 도 INNER JOIN + GROUP BY 라 server-side <500ms.
CREATE OR REPLACE FUNCTION public.bot_visits_today_owner(p_place_ids uuid[])
RETURNS TABLE (
  place_id        uuid,
  bot_id          text,
  page_type       text,
  visits          bigint,
  last_visited_at timestamptz
)
LANGUAGE sql STABLE AS $$
  WITH today_start AS (
    SELECT ((now() AT TIME ZONE 'Asia/Seoul')::date::text || ' 00:00:00')::timestamp
           AT TIME ZONE 'Asia/Seoul' AS ts
  )
  SELECT
    pm.place_id,
    bv.bot_id,
    pm.page_type,
    count(*)::bigint,
    max(bv.visited_at)
  FROM bot_visits bv
  INNER JOIN place_mentions pm ON pm.page_path = bv.path
  CROSS JOIN today_start ts
  WHERE bv.visited_at >= ts.ts
    AND pm.place_id = ANY(p_place_ids)
  GROUP BY pm.place_id, bv.bot_id, pm.page_type;
$$;

-- ── 7. 백필 30일 (마이그레이션 1회 실행) ──────────────────────────────
SELECT public.backfill_bot_visits_daily_owner(30);

-- ── 8. cron 스케줄 (KST 00:10 = UTC 15:10, admin 집계 KST 00:05 후 5분) ─
DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'aggregate-bot-visits-daily-owner';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'aggregate-bot-visits-daily-owner',
  '10 15 * * *',  -- UTC 15:10 = KST 00:10
  $$SELECT public.aggregate_bot_visits_daily_owner()$$
);
