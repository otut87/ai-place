-- 007: 도시 + 카테고리 시드 데이터
-- cities, categories 테이블에 초기 데이터 삽입

-- 도시
INSERT INTO cities (slug, name, name_en) VALUES
  ('cheonan', '천안', 'Cheonan')
ON CONFLICT (slug) DO NOTHING;

-- 카테고리
INSERT INTO categories (slug, name, name_en, icon) VALUES
  ('dermatology', '피부과', 'Dermatology', 'Stethoscope'),
  ('interior', '인테리어', 'Interior Design', 'Paintbrush'),
  ('webagency', '웹에이전시', 'Web Agency', 'Globe'),
  ('auto-repair', '자동차정비', 'Auto Repair', 'Wrench'),
  ('hairsalon', '미용실', 'Hair Salon', 'Scissors')
ON CONFLICT (slug) DO NOTHING;
