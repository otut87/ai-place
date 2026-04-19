-- 025: leads 테이블 — 공개 진단 페이지 리드 수집 (T-139)
-- /check 에서 이메일 입력하면 저장, 영업팀이 F/U.

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  phone text,
  business_name text,
  target_url text,             -- 진단 대상 URL
  diagnostic_score int,        -- 진단 당시 점수 (0~100)
  source text not null default 'check',  -- 'check' | 'owner_check' | ...
  notes text,
  status text not null default 'new',    -- 'new' | 'contacted' | 'converted' | 'archived'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leads_email on leads(email);
create index if not exists idx_leads_status on leads(status) where status <> 'archived';
create index if not exists idx_leads_created_desc on leads(created_at desc);

alter table leads enable row level security;

-- service_role 전용 (admin 만 조회·생성).
