-- T-167 — 컨설팅 engagement 트래킹
-- Phase 11 M11.6

CREATE TABLE IF NOT EXISTS engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'baseline'
    CHECK (status IN ('baseline', 'in_progress', 'verification', 'completed', 'cancelled')),
  contract_amount INT,                              -- KRW
  baseline_run_id UUID REFERENCES diagnostic_runs(id) ON DELETE SET NULL,
  final_run_id UUID REFERENCES diagnostic_runs(id) ON DELETE SET NULL,
  assigned_to TEXT,                                  -- 담당자 이메일
  client_name TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engagement_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  check_id TEXT NOT NULL,                           -- scan-site CheckId
  label TEXT NOT NULL,
  initial_points INT NOT NULL,
  max_points INT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  done_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagements_status ON engagements(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_tasks_engagement ON engagement_tasks(engagement_id);

ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON engagements FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all" ON engagement_tasks FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

COMMENT ON TABLE engagements IS 'T-167 프리미엄 컨설팅 트래킹 - baseline→작업→final 수치 증명';
COMMENT ON TABLE engagement_tasks IS 'T-169 engagement 별 체크리스트 (baseline fail/warn 자동 복제)';
