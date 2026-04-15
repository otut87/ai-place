-- 009: 대분류(Sector) 테이블 + categories에 sector 참조 + 업종사전 83개 시드
-- 확장성: schemaType은 sector에서 자동 결정, 소분류는 자유 확장

-- ===== sectors 테이블 =====
create table if not exists sectors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_en text not null,
  schema_type text not null default 'LocalBusiness',
  created_at timestamptz not null default now()
);

alter table sectors enable row level security;

drop policy if exists "sectors_read" on sectors;
create policy "sectors_read" on sectors for select using (true);

drop policy if exists "sectors_insert" on sectors;
create policy "sectors_insert" on sectors for insert with check (
  (select auth.role()) = 'service_role'
);

-- ===== sectors 시드 데이터 (10개 대분류) =====
insert into sectors (slug, name, name_en, schema_type) values
  ('medical',      '의료',       'Medical',           'MedicalClinic'),
  ('beauty',       '뷰티',       'Beauty',            'BeautySalon'),
  ('living',       '생활서비스',   'Living',            'HomeAndConstructionBusiness'),
  ('auto',         '자동차',      'Auto',              'AutoRepair'),
  ('education',    '교육',       'Education',          'EducationalOrganization'),
  ('professional', '전문서비스',   'Professional',      'ProfessionalService'),
  ('pet',          '반려동물',    'Pet',               'LocalBusiness'),
  ('wedding',      '웨딩·행사',   'Wedding & Events',  'LocalBusiness'),
  ('leisure',      '레저·취미',   'Leisure',           'EntertainmentBusiness'),
  ('food',         '음식',       'Food',              'Restaurant')
on conflict (slug) do nothing;

-- ===== categories 테이블에 sector 컬럼 추가 =====
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sector text;

-- 기존 카테고리에 sector 매핑
UPDATE categories SET sector = 'medical' WHERE slug = 'dermatology';
UPDATE categories SET sector = 'living' WHERE slug = 'interior';
UPDATE categories SET sector = 'professional' WHERE slug = 'webagency';
UPDATE categories SET sector = 'auto' WHERE slug = 'auto-repair';
UPDATE categories SET sector = 'beauty' WHERE slug = 'hairsalon';

-- ===== 신규 소분류 시드 (기존 5개 제외, 78개 추가) =====
INSERT INTO categories (slug, name, name_en, icon, sector) VALUES
  -- 의료
  ('dental',            '치과',           'Dental',              'Stethoscope', 'medical'),
  ('eye',               '안과',           'Ophthalmology',       'Eye',         'medical'),
  ('orthopedics',       '정형외과',        'Orthopedics',         'Stethoscope', 'medical'),
  ('korean-medicine',   '한의원',          'Korean Medicine',     'Stethoscope', 'medical'),
  ('ent',               '이비인후과',       'ENT',                'Stethoscope', 'medical'),
  ('internal-medicine', '내과',           'Internal Medicine',   'Stethoscope', 'medical'),
  ('obgyn',             '산부인과',        'OB/GYN',             'Stethoscope', 'medical'),
  ('pediatrics',        '소아과',          'Pediatrics',          'Stethoscope', 'medical'),
  ('psychiatry',        '정신건강의학과',    'Psychiatry',          'Stethoscope', 'medical'),
  ('rehabilitation',    '재활의학과',       'Rehabilitation',      'Stethoscope', 'medical'),
  ('plastic-surgery',   '성형외과',        'Plastic Surgery',     'Stethoscope', 'medical'),
  ('urology',           '비뇨기과',        'Urology',            'Stethoscope', 'medical'),
  ('pharmacy',          '약국',           'Pharmacy',            'Pill',        'medical'),
  -- 뷰티
  ('nail',              '네일샵',          'Nail Salon',          'Sparkles',    'beauty'),
  ('skincare',          '피부관리',        'Skincare',            'Sparkles',    'beauty'),
  ('lash',              '속눈썹',          'Lash',               'Sparkles',    'beauty'),
  ('waxing',            '왁싱',           'Waxing',             'Sparkles',    'beauty'),
  ('semi-permanent',    '반영구',          'Semi-Permanent',      'Sparkles',    'beauty'),
  ('barbershop',        '바버샵',          'Barbershop',          'Scissors',    'beauty'),
  ('scalp',             '두피·탈모관리',    'Scalp Care',          'Sparkles',    'beauty'),
  ('diet',              '체형관리',        'Body Care',           'Sparkles',    'beauty'),
  -- 생활서비스
  ('moving',            '이사',           'Moving',              'Truck',       'living'),
  ('cleaning',          '청소',           'Cleaning',            'Home',        'living'),
  ('laundry',           '세탁',           'Laundry',            'Home',        'living'),
  ('repair',            '수리',           'Repair',             'Wrench',      'living'),
  ('hardware',          '시공',           'Hardware',            'Home',        'living'),
  ('flower',            '꽃배달',          'Florist',            'Flower',      'living'),
  ('pest-control',      '방역·해충',       'Pest Control',       'Home',        'living'),
  ('locksmith',         '열쇠·잠금',       'Locksmith',          'Home',        'living'),
  ('storage',           '창고·보관',       'Storage',            'Home',        'living'),
  -- 자동차
  ('car-wash',          '세차',           'Car Wash',            'Car',         'auto'),
  ('tire',              '타이어',          'Tire',               'Car',         'auto'),
  ('detailing',         '광택·코팅',       'Detailing',          'Car',         'auto'),
  ('import-repair',     '수입차정비',       'Import Car Repair',  'Car',         'auto'),
  ('scrap',             '폐차',           'Scrap',              'Car',         'auto'),
  ('used-car',          '중고차',          'Used Car',           'Car',         'auto'),
  ('car-rental',        '렌트카',          'Car Rental',         'Car',         'auto'),
  -- 교육
  ('academy',           '입시학원',        'Academy',             'GraduationCap', 'education'),
  ('language',          '어학원',          'Language School',     'GraduationCap', 'education'),
  ('music',             '음악학원',        'Music School',        'Music',         'education'),
  ('art',               '미술학원',        'Art School',          'Palette',       'education'),
  ('sports',            '체육·운동',       'Sports',             'Dumbbell',      'education'),
  ('coding',            '코딩학원',        'Coding School',       'Code',          'education'),
  ('vocational',        '자격증·직업',     'Vocational',          'GraduationCap', 'education'),
  ('kindergarten',      '유치원·어린이집',  'Kindergarten',        'Baby',          'education'),
  ('taekwondo',         '태권도·무술',     'Martial Arts',        'Dumbbell',      'education'),
  ('swimming',          '수영장',          'Swimming',           'Waves',         'education'),
  ('studycafe',         '독서실·스터디카페', 'Study Cafe',         'BookOpen',      'education'),
  -- 전문서비스
  ('legal',             '법률',           'Legal',               'Scale',         'professional'),
  ('tax',               '세무·회계',       'Tax & Accounting',    'Calculator',    'professional'),
  ('realestate',        '부동산',          'Real Estate',        'Building',      'professional'),
  ('insurance',         '보험',           'Insurance',           'Shield',        'professional'),
  ('printing',          '인쇄·간판',       'Printing',           'Printer',       'professional'),
  ('photo',             '사진·영상',       'Photo & Video',      'Camera',        'professional'),
  ('designagency',      '디자인',          'Design',             'Palette',       'professional'),
  ('marketing',         '마케팅·광고',     'Marketing',           'Megaphone',     'professional'),
  -- 반려동물
  ('vet',               '동물병원',        'Veterinary',         'PawPrint',      'pet'),
  ('grooming',          '펫미용',          'Pet Grooming',       'PawPrint',      'pet'),
  ('pet-hotel',         '펫호텔',          'Pet Hotel',          'PawPrint',      'pet'),
  ('pet-shop',          '펫용품',          'Pet Shop',           'PawPrint',      'pet'),
  ('pet-training',      '훈련·교육',       'Pet Training',       'PawPrint',      'pet'),
  -- 웨딩·행사
  ('wedding-hall',      '웨딩홀',          'Wedding Hall',       'Heart',         'wedding'),
  ('wedding-studio',    '스튜디오',        'Studio',             'Camera',        'wedding'),
  ('dress',             '드레스·한복',     'Dress & Hanbok',     'Heart',         'wedding'),
  ('funeral',           '장례식장',        'Funeral',            'Heart',         'wedding'),
  ('catering',          '케이터링·출장뷔페', 'Catering',          'UtensilsCrossed','wedding'),
  -- 레저·취미
  ('kids-cafe',         '키즈카페',        'Kids Cafe',          'Gamepad2',      'leisure'),
  ('karaoke',           '노래방',          'Karaoke',           'Mic',           'leisure'),
  ('bowling',           '볼링장',          'Bowling',            'Gamepad2',      'leisure'),
  ('sauna',             '찜질방·사우나',    'Sauna',             'Gamepad2',      'leisure'),
  ('escape-room',       '방탈출',          'Escape Room',       'Gamepad2',      'leisure'),
  ('pc-room',           'PC방',           'PC Room',            'Monitor',       'leisure'),
  -- 음식
  ('restaurant',        '맛집',           'Restaurant',          'UtensilsCrossed','food'),
  ('cafe',              '카페',           'Cafe',               'Coffee',        'food'),
  ('bakery',            '베이커리',        'Bakery',             'UtensilsCrossed','food'),
  ('delivery',          '배달',           'Delivery',            'UtensilsCrossed','food'),
  ('bar',               '술집·바',         'Bar',               'Wine',          'food'),
  ('buffet',            '뷔페',           'Buffet',             'UtensilsCrossed','food')
ON CONFLICT (slug) DO UPDATE SET sector = EXCLUDED.sector;

COMMENT ON TABLE sectors IS '대분류 — Schema.org 타입과 1:1 매핑';
COMMENT ON COLUMN categories.sector IS '대분류 slug 참조 — schemaType은 여기서 결정';
