-- 051: bot_visits 일별 사전집계 + pg_cron (Phase 1 / A2)
--
-- 배경: 2026-05-06 실측 bot_visits 30일 = 1,174,559 rows.
-- 기존 /admin/seo 페이지가 PostgREST 1000-row cap 우회 페이지네이션 5중 스캔으로
-- 5,875 round-trip 발생 → 5~20분 hang. 단순 윈도우 단축은 band-aid.
--
-- 영구 해결: 매일 KST 00:05 어제 데이터를 일별 집계 테이블로 압축. 페이지는
-- 어제까지 = 사전집계 (수백 rows) + 오늘 = 라이브 RPC (단일 aggregate query) 두 소스 합쳐서
-- <100ms 안에 로드. 데이터 누적량 영향 안 받음.

-- ── 1. bot_id → bot_group 매핑 함수 ───────────────────────────────────
-- src/lib/seo/bot-detection.ts AI_BOT_PATTERNS 의 27개 봇 ID 와 동기화.
CREATE OR REPLACE FUNCTION public.bot_group_of(p_bot_id text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE p_bot_id
    -- ai-training (11)
    WHEN 'gptbot' THEN 'ai-training'
    WHEN 'claudebot' THEN 'ai-training'
    WHEN 'anthropic-ai' THEN 'ai-training'
    WHEN 'ccbot' THEN 'ai-training'
    WHEN 'google-extended' THEN 'ai-training'
    WHEN 'bytespider' THEN 'ai-training'
    WHEN 'amazonbot' THEN 'ai-training'
    WHEN 'applebot-extended' THEN 'ai-training'
    WHEN 'cohere-ai' THEN 'ai-training'
    WHEN 'ai2bot' THEN 'ai-training'
    WHEN 'meta-externalagent' THEN 'ai-training'
    -- ai-search (7)
    WHEN 'chatgpt-user' THEN 'ai-search'
    WHEN 'oai-searchbot' THEN 'ai-search'
    WHEN 'claude-web' THEN 'ai-search'
    WHEN 'perplexitybot' THEN 'ai-search'
    WHEN 'perplexity-user' THEN 'ai-search'
    WHEN 'youbot' THEN 'ai-search'
    WHEN 'duckassistbot' THEN 'ai-search'
    -- search (6)
    WHEN 'googlebot' THEN 'search'
    WHEN 'bingbot' THEN 'search'
    WHEN 'duckduckbot' THEN 'search'
    WHEN 'yeti' THEN 'search'
    WHEN 'daumoa' THEN 'search'
    WHEN 'applebot' THEN 'search'
    -- crawler-other (explicit + fallback)
    WHEN 'googleother' THEN 'crawler-other'
    WHEN 'diffbot' THEN 'crawler-other'
    ELSE 'crawler-other'
  END
$$;

-- ── 2. 일별 집계 테이블 ────────────────────────────────────────────────
-- status 는 200/404/0 의 3-bucket (0 = other/null). PRIMARY KEY 가 NOT NULL 강제.
CREATE TABLE IF NOT EXISTS bot_visits_daily (
  date            date NOT NULL,
  bot_id          text NOT NULL,
  bot_group       text NOT NULL,
  status          int  NOT NULL,
  visits          int  NOT NULL,
  unique_paths    int  NOT NULL,
  last_visited_at timestamptz,
  PRIMARY KEY (date, bot_id, status)
);

CREATE INDEX IF NOT EXISTS idx_bvd_date_desc       ON bot_visits_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_bvd_bot             ON bot_visits_daily(bot_id);
CREATE INDEX IF NOT EXISTS idx_bvd_group_date_desc ON bot_visits_daily(bot_group, date DESC);

-- top 100 paths/status/day. 일자별 보관, 30일치도 ~9000 rows max.
CREATE TABLE IF NOT EXISTS bot_visits_daily_paths (
  date    date NOT NULL,
  path    text NOT NULL,
  status  int  NOT NULL,
  bot_ids text[] NOT NULL,
  visits  int  NOT NULL,
  PRIMARY KEY (date, path, status)
);

CREATE INDEX IF NOT EXISTS idx_bvdp_date_visits        ON bot_visits_daily_paths(date DESC, visits DESC);
CREATE INDEX IF NOT EXISTS idx_bvdp_status_date_visits ON bot_visits_daily_paths(status, date DESC, visits DESC);

ALTER TABLE bot_visits_daily       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_visits_daily_paths ENABLE ROW LEVEL SECURITY;

-- ── 3. 특정 일자 집계 함수 ─────────────────────────────────────────────
-- p_date: 집계 대상 KST 일자. 그 일자의 KST 00:00 ~ 다음날 KST 00:00 의 visited_at 만 포함.
-- ON CONFLICT 로 idempotent — 같은 날짜로 다시 실행하면 row 갱신.
CREATE OR REPLACE FUNCTION public.aggregate_bot_visits_daily_for(p_date date)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_start timestamptz;
  v_end   timestamptz;
BEGIN
  v_start := (p_date::text || ' 00:00:00')::timestamp AT TIME ZONE 'Asia/Seoul';
  v_end   := ((p_date + 1)::text || ' 00:00:00')::timestamp AT TIME ZONE 'Asia/Seoul';

  -- bot_visits_daily: bot_id × status_bucket
  INSERT INTO bot_visits_daily (date, bot_id, bot_group, status, visits, unique_paths, last_visited_at)
  SELECT
    p_date,
    bot_id,
    public.bot_group_of(bot_id),
    CASE WHEN status = 200 THEN 200
         WHEN status = 404 THEN 404
         ELSE 0
    END AS status_bucket,
    count(*)::int,
    count(DISTINCT path)::int,
    max(visited_at)
  FROM bot_visits
  WHERE visited_at >= v_start
    AND visited_at <  v_end
  GROUP BY bot_id, status_bucket
  ON CONFLICT (date, bot_id, status) DO UPDATE SET
    visits          = EXCLUDED.visits,
    unique_paths    = EXCLUDED.unique_paths,
    last_visited_at = EXCLUDED.last_visited_at,
    bot_group       = EXCLUDED.bot_group;

  -- bot_visits_daily_paths: status_bucket 별 top 100 path
  INSERT INTO bot_visits_daily_paths (date, path, status, bot_ids, visits)
  WITH grouped AS (
    SELECT
      path,
      CASE WHEN status = 200 THEN 200
           WHEN status = 404 THEN 404
           ELSE 0
      END AS status_bucket,
      array_agg(DISTINCT bot_id) AS bot_ids,
      count(*)::int AS visits
    FROM bot_visits
    WHERE visited_at >= v_start
      AND visited_at <  v_end
    GROUP BY path, status_bucket
  ),
  ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY status_bucket ORDER BY visits DESC) AS rn
    FROM grouped
  )
  SELECT p_date, path, status_bucket, bot_ids, visits
  FROM ranked
  WHERE rn <= 100
  ON CONFLICT (date, path, status) DO UPDATE SET
    bot_ids = EXCLUDED.bot_ids,
    visits  = EXCLUDED.visits;
END;
$$;

-- ── 4. 매일 cron 이 호출할 wrapper (어제 KST 일자) ──────────────────────
CREATE OR REPLACE FUNCTION public.aggregate_bot_visits_daily()
RETURNS void LANGUAGE sql AS $$
  SELECT public.aggregate_bot_visits_daily_for(((now() AT TIME ZONE 'Asia/Seoul')::date - 1));
$$;

-- ── 5. 백필 helper ─────────────────────────────────────────────────────
-- p_days: 어제부터 거꾸로 N 일치 집계. 마이그레이션 적용 직후 30 호출.
CREATE OR REPLACE FUNCTION public.backfill_bot_visits_daily(p_days int)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  d          date;
  v_end      date;
  v_start    date;
  cnt        int := 0;
BEGIN
  v_end   := (now() AT TIME ZONE 'Asia/Seoul')::date - 1;
  v_start := v_end - (p_days - 1);
  FOR d IN SELECT generate_series(v_start, v_end, '1 day'::interval)::date LOOP
    PERFORM public.aggregate_bot_visits_daily_for(d);
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END;
$$;

-- ── 6. 오늘 데이터 라이브 aggregate (RPC, 페이지가 직접 호출) ───────────
-- 페이지는 어제까지 = 테이블 select + 오늘 = RPC 합쳐서 표시.
-- 1 일치 ~39K rows 도 server-side aggregate 라 <500ms.
CREATE OR REPLACE FUNCTION public.bot_visits_today_summary()
RETURNS TABLE (
  bot_id          text,
  bot_group       text,
  status          int,
  visits          bigint,
  unique_paths    bigint,
  last_visited_at timestamptz
)
LANGUAGE sql STABLE AS $$
  WITH today_start AS (
    SELECT ((now() AT TIME ZONE 'Asia/Seoul')::date::text || ' 00:00:00')::timestamp
           AT TIME ZONE 'Asia/Seoul' AS ts
  )
  SELECT
    bot_id,
    public.bot_group_of(bot_id),
    (CASE WHEN status = 200 THEN 200 WHEN status = 404 THEN 404 ELSE 0 END)::int,
    count(*)::bigint,
    count(DISTINCT path)::bigint,
    max(visited_at)
  FROM bot_visits, today_start
  WHERE visited_at >= today_start.ts
  GROUP BY bot_id, 2, 3;
$$;

CREATE OR REPLACE FUNCTION public.bot_visits_today_top_paths(p_limit int DEFAULT 100)
RETURNS TABLE (path text, status int, bot_ids text[], visits bigint)
LANGUAGE sql STABLE AS $$
  WITH today_start AS (
    SELECT ((now() AT TIME ZONE 'Asia/Seoul')::date::text || ' 00:00:00')::timestamp
           AT TIME ZONE 'Asia/Seoul' AS ts
  ),
  grouped AS (
    SELECT
      path,
      (CASE WHEN status = 200 THEN 200 WHEN status = 404 THEN 404 ELSE 0 END)::int AS status_bucket,
      array_agg(DISTINCT bot_id) AS bot_ids,
      count(*)::bigint AS visits
    FROM bot_visits, today_start
    WHERE visited_at >= today_start.ts
    GROUP BY path, status_bucket
  ),
  ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY status_bucket ORDER BY visits DESC) AS rn
    FROM grouped
  )
  SELECT path, status_bucket, bot_ids, visits
  FROM ranked
  WHERE rn <= p_limit;
$$;

-- ── 7. 백필 30일 (마이그레이션 1회 실행) ───────────────────────────────
SELECT public.backfill_bot_visits_daily(30);

-- ── 8. cron 스케줄 (KST 00:05 = UTC 15:05) ────────────────────────────
-- 기존 동일 jobname 스케줄이 있으면 unschedule 후 재등록 (idempotent).
DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'aggregate-bot-visits-daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'aggregate-bot-visits-daily',
  '5 15 * * *',  -- UTC 15:05 = KST 00:05
  $$SELECT public.aggregate_bot_visits_daily()$$
);
