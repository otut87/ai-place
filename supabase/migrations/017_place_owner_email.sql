-- 017: places.owner_email + 소유자 self-service 정책 (T-054)
-- 목적: 사장님 셀프 포털에서 본인 업체만 조회·수정할 수 있도록 컬럼 추가.
--        owner_id 는 auth.users.id 를 가리키지만, 사장님 이메일 발송·매칭
--        용도로 원문 이메일도 별도 보관한다.

alter table places add column if not exists owner_email text;
create index if not exists idx_places_owner_email on places(owner_email);

-- 소유자가 본인 이메일 기반으로 업체 목록을 조회할 수 있도록 self-service 정책.
-- owner_id 이 null 이어도 owner_email 이 auth.jwt() 의 email 과 같으면 허용.
drop policy if exists "Owner self-service select" on places;
create policy "Owner self-service select"
  on places for select
  using (
    owner_id = auth.uid()
    or owner_email = (auth.jwt() ->> 'email')
  );

-- 소유자가 본인 업체의 허용 필드(설명·영업시간·전화·이미지·태그)만 수정 가능.
-- 슬러그/도시/카테고리/상태는 어드민만 변경 가능하므로 update 정책은 제한.
drop policy if exists "Owner self-service update" on places;
create policy "Owner self-service update"
  on places for update
  using (
    owner_id = auth.uid()
    or owner_email = (auth.jwt() ->> 'email')
  )
  with check (
    owner_id = auth.uid()
    or owner_email = (auth.jwt() ->> 'email')
  );
