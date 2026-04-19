-- T-171 — 파일럿 30일 무료 체험
-- Phase 11 M11.7

ALTER TABLE customers ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- 신규 가입 시 자동 설정 (application 레이어에서)
COMMENT ON COLUMN customers.trial_started_at IS 'T-171 파일럿 시작 시각 (가입 시점)';
COMMENT ON COLUMN customers.trial_ends_at IS 'T-171 파일럿 종료 — 이후 자동 월 9,900원 결제';
