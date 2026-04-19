-- 신고 접수 + 소유권 이관 문의.
-- place_reports: 공개 사용자/로그인 사용자 누구나 "잘못된 정보·폐업·스팸" 신고.
-- ownership_claims: 로그인 사용자가 "이 업체가 내 소유다" 주장 → admin 이 검토 후 owner 재할당.

-- ============================================================
-- 1) place_reports
-- ============================================================
create table if not exists place_reports (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_email text,
  reporter_ip text,                 -- 레이트리밋용, 장기 보관 X
  reason text not null check (reason in ('closed', 'wrong_info', 'spam', 'duplicate', 'inappropriate', 'other')),
  detail text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_place_reports_place on place_reports(place_id);
create index if not exists idx_place_reports_status on place_reports(status);
create index if not exists idx_place_reports_created on place_reports(created_at desc);

comment on table place_reports is '업체 정보 신고 — 공개 사용자 누구나 제출 가능, admin 이 검토';
comment on column place_reports.reason is '신고 사유: closed(폐업), wrong_info(잘못된 정보), spam(스팸), duplicate(중복), inappropriate(부적절), other';
comment on column place_reports.reporter_ip is '레이트리밋용, 주기적 삭제';

-- ============================================================
-- 2) ownership_claims
-- ============================================================
create table if not exists ownership_claims (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  claimant_user_id uuid not null references auth.users(id) on delete cascade,
  claimant_email text,
  current_owner_email text,              -- 현재 owner (admin 검토 시 참고)
  reason text,                           -- 클레임 사유 (사업자등록증 보유, 실제 대표자 등)
  evidence_url text,                     -- 선택적 증빙 파일 URL (사업자등록증 등)
  contact_phone text,                    -- admin 이 연락할 전화번호
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ownership_claims_place on ownership_claims(place_id);
create index if not exists idx_ownership_claims_claimant on ownership_claims(claimant_user_id);
create index if not exists idx_ownership_claims_status on ownership_claims(status);
create index if not exists idx_ownership_claims_created on ownership_claims(created_at desc);

-- 한 사용자가 한 업체에 중복 pending 클레임 금지 (idempotent)
create unique index if not exists uq_ownership_claims_pending_user_place
  on ownership_claims(place_id, claimant_user_id)
  where status = 'pending';

comment on table ownership_claims is '업체 소유권 이관 문의 — 로그인 사용자가 "내 업체" 주장';
comment on column ownership_claims.evidence_url is '사업자등록증 등 증빙 파일 (Supabase Storage URL)';

-- ============================================================
-- 3) RLS
-- ============================================================
alter table place_reports enable row level security;
alter table ownership_claims enable row level security;

-- 신고: admin 만 읽기/수정, insert 는 누구나 (rate limit 은 application 레이어)
drop policy if exists place_reports_admin_all on place_reports;
create policy place_reports_admin_all on place_reports
  for all using (
    (select email from auth.users where id = auth.uid()) in ('methoddesign7@gmail.com', 'support@dedo.kr')
  );

-- 클레임: 본인이 제출한 건은 읽기 가능, admin 은 전체
drop policy if exists ownership_claims_own_read on ownership_claims;
create policy ownership_claims_own_read on ownership_claims
  for select using (
    claimant_user_id = auth.uid()
    or (select email from auth.users where id = auth.uid()) in ('methoddesign7@gmail.com', 'support@dedo.kr')
  );

drop policy if exists ownership_claims_admin_write on ownership_claims;
create policy ownership_claims_admin_write on ownership_claims
  for update using (
    (select email from auth.users where id = auth.uid()) in ('methoddesign7@gmail.com', 'support@dedo.kr')
  );
