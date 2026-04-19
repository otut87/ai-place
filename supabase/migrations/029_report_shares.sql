-- T-165 — 공유 링크 리포트 (로그인 없이 열람 가능)
-- Phase 11 M11.5

CREATE TABLE IF NOT EXISTS report_shares (
  hash TEXT PRIMARY KEY,                        -- URL path 에 사용되는 해시 (16자 권장)
  run_id UUID NOT NULL REFERENCES diagnostic_runs(id) ON DELETE CASCADE,
  title TEXT,                                   -- 예: "천안 카페 A사 — 2026-04 진단"
  client_name TEXT,
  baseline_run_id UUID REFERENCES diagnostic_runs(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  views INT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_shares_run ON report_shares(run_id);
CREATE INDEX IF NOT EXISTS idx_report_shares_expiry ON report_shares(expires_at);

ALTER TABLE report_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON report_shares
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

COMMENT ON TABLE report_shares IS 'T-165 진단 리포트 공유 링크 (로그인 없이 열람, 30일 기본 만료)';
