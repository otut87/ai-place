-- 023: 자동발행 정책 (T-079)
-- 카테고리별 autopublish_enabled + review_delay_hours (기본 24시간 유예).

alter table categories
  add column if not exists autopublish_enabled boolean not null default false;

alter table categories
  add column if not exists review_delay_hours int not null default 24;
