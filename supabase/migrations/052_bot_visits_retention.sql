-- 052: bot_visits 30일 보존 정책 (Phase 2 작업1)
--
-- 배경: 2026-05-06 실측 bot_visits 30일 = 1,174,559 rows. Meta-ExternalAgent 단일
-- 봇이 일 평균 ~39K 추가. 누적량을 무한정 보존하면 storage·index·VACUUM 비용이
-- 계속 증가함. 일별 집계(051)가 영구 보존되므로 raw row는 30일 윈도우만 유지하면
-- 모든 admin/owner UI·통계가 정상 동작함.
--
-- 안전장치: 일별 집계 테이블이 cutoff 이전 날짜를 커버할 때만 raw row 삭제.
-- 집계 cron이 한 번이라도 실패해도 raw 보존 → 다음 cron에서 backfill 가능.

-- ── 1. cleanup 함수 ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_bot_visits_old_rows(retention_days int DEFAULT 30)
RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  v_cutoff_date date;
  v_cutoff_ts timestamptz;
  v_deleted bigint := 0;
  v_max_aggregated date;
BEGIN
  IF retention_days < 7 THEN
    RAISE EXCEPTION 'retention_days must be >= 7 (got %)', retention_days;
  END IF;

  -- KST 자정 기준 cutoff (이 날짜 이전 = 삭제 대상)
  v_cutoff_date := ((now() AT TIME ZONE 'Asia/Seoul')::date - retention_days);
  v_cutoff_ts := (v_cutoff_date::text || ' 00:00:00')::timestamp AT TIME ZONE 'Asia/Seoul';

  -- 안전장치: 일별 집계가 cutoff 직전(=cutoff_date - 1)까지 존재해야 삭제 허용.
  -- 집계 cron이 실패한 상태에서 raw 삭제하면 영구 데이터 손실.
  SELECT max(date) INTO v_max_aggregated FROM public.bot_visits_daily;

  IF v_max_aggregated IS NULL OR v_max_aggregated < (v_cutoff_date - 1) THEN
    RAISE WARNING 'cleanup_bot_visits_old_rows skipped: max aggregated date % is older than cutoff %',
      coalesce(v_max_aggregated::text, 'NULL'), v_cutoff_date;
    RETURN 0;
  END IF;

  DELETE FROM public.bot_visits
  WHERE visited_at < v_cutoff_ts;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RAISE NOTICE 'cleanup_bot_visits_old_rows deleted % rows older than %',
    v_deleted, v_cutoff_ts;

  RETURN v_deleted;
END $$;

COMMENT ON FUNCTION public.cleanup_bot_visits_old_rows(int) IS
  'bot_visits raw rows 보존 정책. 일별 집계(bot_visits_daily)가 cutoff 직전까지 커버할 때만 삭제.';

-- ── 2. cron 스케줄 (KST 02:00 = UTC 17:00, 일별 집계 KST 00:05 이후) ────
DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'cleanup-bot-visits-30d';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-bot-visits-30d',
  '0 17 * * *',  -- UTC 17:00 = KST 02:00
  $$SELECT public.cleanup_bot_visits_old_rows(30)$$
);

-- ── 3. 즉시 1회 실행 (마이그레이션 시점에 30일 초과분 청소) ──────────────
-- 일별 집계가 backfill로 30일 이상 커버 중 → 안전하게 즉시 실행 가능.
SELECT public.cleanup_bot_visits_old_rows(30);
