-- 024: bot_visits — AI 크롤러 방문 로그 (T-081)
-- 추가리뷰 §10: "증명 도구가 제품의 핵심". 월 1회 고객 리포트의 근거.

create table if not exists bot_visits (
  id bigserial primary key,
  bot_id text not null,                  -- 'gptbot' | 'claudebot' | 'perplexitybot' | 'ccbot' | 'google-extended' ...
  user_agent text,
  path text not null,
  status int,                            -- HTTP 응답 상태
  referer text,
  city text,                             -- 경로에서 추출 (/cheonan/dermatology/... 등)
  category text,
  place_slug text,
  visited_at timestamptz not null default now()
);

create index if not exists idx_bot_visits_visited_desc on bot_visits(visited_at desc);
create index if not exists idx_bot_visits_bot on bot_visits(bot_id);
create index if not exists idx_bot_visits_city_cat on bot_visits(city, category) where city is not null;

alter table bot_visits enable row level security;
