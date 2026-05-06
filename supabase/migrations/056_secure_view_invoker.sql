-- 056: blog_topic_queue_summary view 의 SECURITY DEFINER → SECURITY INVOKER (T-275)
--
-- 배경: Supabase advisor 가 critical 등급 경고 — public.blog_topic_queue_summary 가
-- SECURITY DEFINER 로 동작 중. 이는 view 호출 시 view 작성자(보통 postgres superuser)
-- 권한으로 실행되어 RLS 정책을 우회할 수 있음. 일반 사용자가 이 view 를 SELECT 하면
-- blog_topic_queue 테이블의 RLS 가 무력화될 위험.
--
-- 현재 grant 는 service_role 에만 있어 실질 노출은 없지만, advisor 가 권고하는 안전한
-- 기본값(security_invoker=on) 으로 명시적으로 전환. PostgreSQL 15+ 에서 지원.
--
-- 효과: view 가 querying user 의 권한 + RLS 로 동작. service_role 호출 시엔 동일하게
-- 모든 row 접근 가능 (RLS bypass 권한). 일반 user 호출은 RLS 통과한 row 만 노출.

ALTER VIEW public.blog_topic_queue_summary SET (security_invoker = true);
