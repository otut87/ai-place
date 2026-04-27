-- 049: 아산(Asan) 도시 추가
-- 천안 인근 충남 도시. 천안아산역 권역 업체 대상 카버리지 확장.

INSERT INTO cities (slug, name, name_en) VALUES
  ('asan', '아산', 'Asan')
ON CONFLICT (slug) DO NOTHING;
