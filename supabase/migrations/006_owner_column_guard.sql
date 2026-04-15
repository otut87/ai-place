-- 006: owner 수정 가능 컬럼 제한
-- owner가 rating, review_count, google_place_id 등 보호 필드를 수정하지 못하게 트리거로 방어.
-- RLS는 컬럼 레벨 제한을 지원하지 않으므로 trigger + BEFORE UPDATE로 구현.

create or replace function guard_owner_columns()
returns trigger as $$
begin
  -- service_role은 모든 컬럼 수정 가능
  if (select auth.role()) = 'service_role' then
    return new;
  end if;

  -- owner는 보호 필드 변경 불가 (원래 값으로 복원)
  new.rating := old.rating;
  new.review_count := old.review_count;
  new.google_place_id := old.google_place_id;
  new.google_business_url := old.google_business_url;
  new.review_summaries := old.review_summaries;
  new.city := old.city;
  new.category := old.category;
  new.slug := old.slug;
  new.status := old.status;
  new.owner_id := old.owner_id;

  return new;
end;
$$ language plpgsql;

drop trigger if exists guard_owner_columns_trigger on places;
create trigger guard_owner_columns_trigger
  before update on places
  for each row execute function guard_owner_columns();
