-- 014: places-images 스토리지 버킷 + places.images JSONB 컬럼 (T-050)
-- 목적: 업체당 다중 이미지(대표/내부/시술/스태프/장비)를 Supabase Storage 에
--        업로드하고 url + alt + type 메타를 places.images JSONB 에 보관한다.

-- 14.1 places.images — 이미지 메타 배열 (T-050)
-- 구조: [{ "url": "...", "alt": "...", "type": "exterior" }]
alter table places add column if not exists images jsonb;

-- 14.2 Storage 버킷 생성 — 공개 읽기 허용
insert into storage.buckets (id, name, public)
values ('places-images', 'places-images', true)
on conflict (id) do nothing;

-- 14.3 RLS 정책 — 읽기는 누구나, 쓰기/삭제는 서비스 롤(어드민)만.
-- storage.objects 의 기존 정책이 이미 있을 수 있으므로 idempotent 하게 drop + create.
drop policy if exists "places-images public read" on storage.objects;
create policy "places-images public read"
  on storage.objects for select
  using (bucket_id = 'places-images');

drop policy if exists "places-images service write" on storage.objects;
create policy "places-images service write"
  on storage.objects for insert
  with check (bucket_id = 'places-images' and auth.role() = 'service_role');

drop policy if exists "places-images service update" on storage.objects;
create policy "places-images service update"
  on storage.objects for update
  using (bucket_id = 'places-images' and auth.role() = 'service_role');

drop policy if exists "places-images service delete" on storage.objects;
create policy "places-images service delete"
  on storage.objects for delete
  using (bucket_id = 'places-images' and auth.role() = 'service_role');
