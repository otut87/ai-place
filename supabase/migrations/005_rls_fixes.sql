-- 005: RLS 보안 수정
-- HIGH-1: owner status 자가승인 방지
-- HIGH-2: DELETE 정책 추가 (service_role)
-- HIGH-3: places.slug 글로벌 유니크 추가

-- ===== HIGH-1: owner가 status 변경 못하게 WITH CHECK 추가 =====
drop policy if exists "places_owner_update" on places;
create policy "places_owner_update" on places for update
  using (owner_id = auth.uid())
  with check (status = 'pending');

-- ===== HIGH-2: DELETE 정책 (service_role만) =====
drop policy if exists "places_delete" on places;
create policy "places_delete" on places for delete using (
  (select auth.role()) = 'service_role'
);

drop policy if exists "blog_posts_delete" on blog_posts;
create policy "blog_posts_delete" on blog_posts for delete using (
  (select auth.role()) = 'service_role'
);

-- ===== HIGH-3: places.slug 글로벌 유니크 =====
-- 기존 composite unique(city, category, slug)는 유지하되, slug만으로도 유니크 보장
-- 현재 데이터에 slug 중복 없음 전제
create unique index if not exists idx_places_slug_unique on places(slug);
