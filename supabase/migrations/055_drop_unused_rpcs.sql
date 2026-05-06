-- 055: 사용 안 하는 RPC 함수 drop (T-274)
--
-- 배경: T-264~T-273 owner 대시보드 perf 작업에서 053·054 의 RPC 함수들을 raw PostgREST
-- select 로 회귀 (RPC dispatch 가 raw 보다 5-8초 느렸음). 코드는 모두 이전됐고 RPC 호출
-- 0건. 함수만 남아있어 schema bloat + supabase function explorer 노이즈.
--
-- Drop 대상:
--   1) owner_bot_visits_daily_select(uuid[], date, date) — 053 도입, T-271 raw 회귀.
--   2) owner_recent_bot_visits(uuid[], int, timestamptz, timestamptz) — 054 도입, T-270 raw 회귀.
--   3) bot_visits_today_owner(uuid[]) — 053 도입, T-272 raw 회귀.
--
-- 보존 (다른 곳에서 사용):
--   - bot_visits_today_summary() — admin/seo 페이지용 (051).
--   - bot_visits_today_top_paths(int) — admin/seo 페이지용 (051).
--   - aggregate_bot_visits_daily_for(date) / aggregate_bot_visits_daily() — pg_cron.
--   - aggregate_bot_visits_daily_owner_for(date) / aggregate_bot_visits_daily_owner() — pg_cron.
--   - cleanup_bot_visits_old_rows(int) — pg_cron (052).
--   - bot_group_of(text) — 051 aggregator 가 사용.
--
-- IF EXISTS — 이미 drop 된 환경에서도 idempotent.

DROP FUNCTION IF EXISTS public.owner_bot_visits_daily_select(uuid[], date, date);
DROP FUNCTION IF EXISTS public.owner_recent_bot_visits(uuid[], int, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.bot_visits_today_owner(uuid[]);
