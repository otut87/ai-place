-- 057: Supabase advisor security lints fix (T-276)
--
-- 4건 advisor 경고 중 코드로 fix 가능한 2건 처리. 나머지 2건은 사용자가 Supabase
-- Studio 에서 수동 처리 (storage policy, auth setting).
--
-- 1) Function Search Path Mutable — public.bot_group_of(text)
--    함수에 SET search_path 가 없으면 호출자의 search_path 따라 동작 → 다른 schema 의
--    동명 객체로 hijack 위험. 빈 문자열 또는 'pg_catalog' 로 명시 권장.
--
-- 2) Public Can Execute SECURITY DEFINER — public.pick_target_query(text, text, text, text)
--    034 마이그레이션이 grant execute to service_role 만 명시했지만 PostgreSQL 기본 동작
--    상 함수 생성 시 PUBLIC 에 EXECUTE 자동 부여. anon/authenticated 가 REST RPC 로 호출
--    가능 (RLS bypass 가 가능한 keyword_bank 발급 함수 — 노출 시 큐 고갈/중복 issue).
--    PUBLIC/anon/authenticated 에서 회수, service_role 만 유지.
--
-- 사용자 작업 (코드 외):
--   - storage.places-images bucket: Supabase Studio → Storage → places-images → Policies
--     에서 broad SELECT policy 좁히기 (object 단위 access 만 허용).
--   - Auth Leaked Password Protection: Supabase Studio → Authentication → Providers →
--     Email → Password Strength 에서 "Check passwords against HaveIBeenPwned" 활성화.

-- ── 1. bot_group_of: search_path 명시 ────────────────────────────────
-- IMMUTABLE PARALLEL SAFE 함수라 SET search_path 추가해도 동작 동일.
-- 빈 문자열 = 모든 식별자를 schema-qualified 로 사용 (이 함수는 외부 객체 참조 없어 안전).
ALTER FUNCTION public.bot_group_of(text) SET search_path = '';

-- ── 2. pick_target_query: PUBLIC/anon/authenticated EXECUTE 회수 ─────
-- service_role grant 는 034 에서 명시. 회수 후에도 service_role 호출은 정상.
-- IF EXISTS 없는 REVOKE 는 함수가 없으면 에러나므로 idempotent 처리 위해 DO 블록.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'pick_target_query'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.pick_target_query(text, text, text, text) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.pick_target_query(text, text, text, text) FROM anon;
    REVOKE EXECUTE ON FUNCTION public.pick_target_query(text, text, text, text) FROM authenticated;
  END IF;
END $$;
