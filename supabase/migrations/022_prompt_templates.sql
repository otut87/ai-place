-- 022: prompt_templates — 카테고리별 프롬프트 버전 관리 (T-077)
-- 원칙: ai_generations(013) 에 prompt_template_id 컬럼 1개만 추가. 별도 트래킹 테이블 금지.

create table if not exists prompt_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,                -- 카테고리 slug (예: 'dermatology')
  version int not null,                  -- 1, 2, 3, ...
  system_prompt text not null,
  user_template text not null,           -- {{name}}, {{address}} 등 치환 토큰 포함
  active boolean not null default false, -- 같은 카테고리에서 active=true 는 최대 1개
  notes text,                            -- 변경 이유
  created_at timestamptz not null default now()
);

create unique index if not exists uq_prompt_templates_cat_version
  on prompt_templates(category, version);

-- 카테고리별 active 는 유일 (DB 레벨 unique)
create unique index if not exists uq_prompt_templates_cat_active
  on prompt_templates(category) where active;

create index if not exists idx_prompt_templates_cat on prompt_templates(category);

alter table prompt_templates enable row level security;

-- ai_generations 에 prompt_template_id 추가 (A/B 집계용)
alter table ai_generations
  add column if not exists prompt_template_id uuid references prompt_templates(id) on delete set null;
create index if not exists idx_ai_generations_prompt_template
  on ai_generations(prompt_template_id) where prompt_template_id is not null;
