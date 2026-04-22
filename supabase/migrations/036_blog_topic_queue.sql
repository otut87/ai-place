-- 036: 블로그 토픽 큐 (T-196 / Phase 4)
-- daily-planner 크론이 매일 10편 토픽을 INSERT, pipeline-consume 15분 크론이 순차 pop.
-- pop 은 FOR UPDATE SKIP LOCKED RPC 로 동시 consumer 경합 방어.

-- ============================================================
-- 1) blog_topic_queue — 발행 예약 큐
-- ============================================================
create table if not exists blog_topic_queue (
  id uuid primary key default gen_random_uuid(),
  planned_date date not null,
  post_type text not null check (post_type in ('detail', 'compare', 'guide', 'keyword')),
  angle text,
  sector text not null,
  city text not null,
  category text,
  target_query text,
  keyword_id uuid references keyword_bank(id) on delete set null,
  place_id uuid references places(id) on delete set null,
  -- 실제 pipeline 실행 시점 (09:00~22:00 KST 분산)
  scheduled_for timestamptz not null,
  -- queued → processing → done (성공)
  -- queued → processing → failed (재시도 소진)
  -- queued → processing → failed_quality / failed_similarity / failed_timeout (pipeline status 반영)
  status text not null default 'queued' check (status in (
    'queued', 'processing', 'done',
    'failed', 'failed_quality', 'failed_similarity', 'failed_timeout'
  )),
  retry_count int not null default 0,
  blog_post_id uuid references blog_posts(id) on delete set null,
  error text,
  -- pipeline 시작/완료 시각
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- consumer 핫패스 — queued + scheduled_for <= now() 우선.
create index if not exists idx_blog_topic_queue_consume
  on blog_topic_queue (status, scheduled_for)
  where status = 'queued';

-- 관리자 대시보드 — 일자별 큐 조회
create index if not exists idx_blog_topic_queue_date
  on blog_topic_queue (planned_date desc, status);

-- ============================================================
-- 2) RLS — service role 만 쓰기/읽기
-- ============================================================
alter table blog_topic_queue enable row level security;

drop policy if exists "blog_topic_queue admin" on blog_topic_queue;
create policy "blog_topic_queue admin"
  on blog_topic_queue for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================
-- 3) pop_blog_topic() — 경합 방어 원자 pop
-- Supabase JS 는 FOR UPDATE SKIP LOCKED 를 직접 쓸 수 없으므로 RPC 로 감쌈.
-- scheduled_for <= now() 인 queued row 중 가장 오래된 것 1건 획득 + processing 으로 전환.
-- ============================================================
create or replace function pop_blog_topic(p_max_retries int default 3)
returns table (
  id uuid,
  planned_date date,
  post_type text,
  angle text,
  sector text,
  city text,
  category text,
  target_query text,
  keyword_id uuid,
  place_id uuid,
  scheduled_for timestamptz,
  retry_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  picked_id uuid;
begin
  select q.id into picked_id
  from blog_topic_queue q
  where q.status = 'queued'
    and q.scheduled_for <= now()
    and q.retry_count < p_max_retries
  order by q.scheduled_for asc, q.created_at asc
  limit 1
  for update skip locked;

  if picked_id is null then
    return;
  end if;

  update blog_topic_queue
  set status = 'processing',
      started_at = now()
  where blog_topic_queue.id = picked_id;

  return query
  select q.id, q.planned_date, q.post_type, q.angle, q.sector, q.city, q.category,
         q.target_query, q.keyword_id, q.place_id, q.scheduled_for, q.retry_count
  from blog_topic_queue q
  where q.id = picked_id;
end;
$$;

comment on function pop_blog_topic(int) is
  'FOR UPDATE SKIP LOCKED — 동시 consumer 가 돌아도 각자 다른 큐 row 를 받음.';

grant execute on function pop_blog_topic(int) to service_role;

-- ============================================================
-- 4) 관리자 대시보드 — 최근 N일 토픽 큐 상태 집계 뷰 (읽기 편의)
-- ============================================================
create or replace view blog_topic_queue_summary as
select
  planned_date,
  status,
  post_type,
  count(*) as count
from blog_topic_queue
where planned_date >= current_date - interval '30 days'
group by planned_date, status, post_type
order by planned_date desc;

grant select on blog_topic_queue_summary to service_role;

comment on table blog_topic_queue is '매일 10편 블로그 자동 발행 큐 (daily-planner → pipeline-consume)';
comment on column blog_topic_queue.scheduled_for is '09:00~22:00 KST 분산 — consumer 가 이 시각 이후 pop';
comment on column blog_topic_queue.retry_count is '3회 초과 시 영구 failed';
