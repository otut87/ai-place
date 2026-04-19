-- T-159 — 진단 이력 저장 (Before/After 비교·추이 차트용)
-- Phase 11 M11.4 (diagnostic_runs)

CREATE TABLE IF NOT EXISTS diagnostic_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,                   -- 진단 대상 전체 URL
  origin TEXT NOT NULL,                -- host 단위 집계용 (https://aiplace.kr)
  score INT NOT NULL CHECK (score >= 0 AND score <= 100),
  checks JSONB NOT NULL,               -- CheckResult[] 전체 저장
  pages_scanned INT NOT NULL DEFAULT 1,
  sitemap_present BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_by TEXT NOT NULL,          -- 'public' | 'owner' | 'cron' | 'premium'
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  engagement_id UUID,                  -- 프리미엄 컨설팅 연결 (engagements 테이블, 아직 미생성)
  user_agent TEXT,                     -- 클라이언트 UA (최대 200자)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- origin + 시간순 역순 조회 (이력 비교)
CREATE INDEX IF NOT EXISTS idx_diagnostic_runs_origin_time
  ON diagnostic_runs(origin, created_at DESC);

-- customer_id 기반 Owner 대시보드 조회
CREATE INDEX IF NOT EXISTS idx_diagnostic_runs_customer
  ON diagnostic_runs(customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

-- 30일 지난 익명(public) 데이터 자동 정리 대상 식별
CREATE INDEX IF NOT EXISTS idx_diagnostic_runs_cleanup
  ON diagnostic_runs(created_at)
  WHERE customer_id IS NULL;

-- RLS: 기본 비활성, Service Role 만 접근. (익명 저장이라 Row 단위 격리 불필요)
ALTER TABLE diagnostic_runs ENABLE ROW LEVEL SECURITY;

-- Service role 만 read/write
CREATE POLICY "service_role_all" ON diagnostic_runs
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE diagnostic_runs IS 'T-159 진단 실행 이력 - Before/After 비교·추이·컨설팅 증명용';
COMMENT ON COLUMN diagnostic_runs.origin IS 'Same-origin 묶음 (예: https://aiplace.kr) - 이력 조회 키';
COMMENT ON COLUMN diagnostic_runs.checks IS 'CheckResult[] JSONB - 디테일 분석 및 UI 재구성용';
COMMENT ON COLUMN diagnostic_runs.triggered_by IS 'public=익명/check 페이지, owner=구독자 대시보드, cron=주기적 모니터링, premium=컨설팅';
