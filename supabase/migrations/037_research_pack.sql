-- 037: Researcher pack + GSC 성과 피드백 (T-197 / Phase 5)

-- blog_posts — writer 에 주입된 researchPack 저장 (디버그/회고 용)
alter table blog_posts add column if not exists research_pack jsonb;

-- keyword_bank — GSC 성과 기반 priority 동적 조정
alter table keyword_bank add column if not exists priority_updated_at timestamptz;
alter table keyword_bank add column if not exists avg_ctr numeric(4,3);   -- 0.000 ~ 1.000
alter table keyword_bank add column if not exists avg_impressions int;

-- blog_posts — GSC 성과 캐시 (주 1회 갱신)
alter table blog_posts add column if not exists gsc_impressions int;
alter table blog_posts add column if not exists gsc_clicks int;
alter table blog_posts add column if not exists gsc_ctr numeric(4,3);
alter table blog_posts add column if not exists gsc_avg_position numeric(5,2);
alter table blog_posts add column if not exists gsc_updated_at timestamptz;

-- ctr 범위 체크
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'keyword_bank_avg_ctr_range') then
    alter table keyword_bank
      add constraint keyword_bank_avg_ctr_range
      check (avg_ctr is null or (avg_ctr >= 0 and avg_ctr <= 1));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blog_posts_gsc_ctr_range') then
    alter table blog_posts
      add constraint blog_posts_gsc_ctr_range
      check (gsc_ctr is null or (gsc_ctr >= 0 and gsc_ctr <= 1));
  end if;
end $$;

-- 성능 조회용 인덱스 — 상위 CTR 키워드 정렬
create index if not exists idx_keyword_bank_priority_ctr
  on keyword_bank (priority asc, avg_ctr desc nulls last)
  where active = true;

comment on column blog_posts.research_pack is 'writer 입력 researchPack (T-191 summaries·service priceBands·hoursBand 등)';
comment on column keyword_bank.avg_ctr is 'GSC 실측 CTR (30일 이동평균) — priority 동적 조정 기반';
comment on column blog_posts.gsc_ctr is 'GSC 페이지별 CTR (주 1회 cron)';
