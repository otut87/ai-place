-- 007: GEO 추천 로직 필드 추가
-- GPT/Claude/Gemini 리뷰 반영: AI가 추천 가능한 구조로 전환

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS recommended_for jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS strengths jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS place_type text,
  ADD COLUMN IF NOT EXISTS recommendation_note text;

COMMENT ON COLUMN places.recommended_for IS '추천 대상 목록 (예: ["여드름 치료 필요한 환자"])';
COMMENT ON COLUMN places.strengths IS '업체 강점 목록 (예: ["피부질환 중심 진료"])';
COMMENT ON COLUMN places.place_type IS '업체 유형 (질환치료형/미용시술형/프리미엄 등)';
COMMENT ON COLUMN places.recommendation_note IS '40-60자 추천형 Direct Answer Block';
