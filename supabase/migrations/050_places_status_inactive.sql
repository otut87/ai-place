-- T-259 R6 (2B): places.status check 제약에 'inactive' 추가.
--
-- 파일럿(trial_ends_at) 만료 + 카드 미등록 owner 의 place 를 cron 이 'inactive' 로
-- 전환할 수 있어야 한다. 'rejected' 는 admin 검수 거절을 의미하므로 의미 분리 필요.
--
-- 영향:
--   - 공개 페이지·sitemap·blog enqueue 등 status='active' 만 대상으로 하는 경로에는
--     cascade 로 자동 차단 (SELECT * WHERE status='active' 패턴 그대로).
--   - 카드 등록 시 issueBillingKeyAction 의 reactivation 은 status='pending' 만 대상.
--     'inactive' 는 별도 액션으로 복구 (또는 동일 update 에서 'inactive' 도 포함하도록 확장 가능).

alter table places drop constraint if exists places_status_check;
alter table places add constraint places_status_check
  check (status in ('active', 'pending', 'rejected', 'inactive'));
