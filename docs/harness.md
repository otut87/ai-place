# Development Harness

> **목적**: 모든 개발 작업이 TDD + 리뷰 + TASK 추적 워크플로를 거치도록 강제.
> 테스트·리뷰·TASK 업데이트 없는 변경은 **빌드 실패**.

---

## 워크플로

```
[1] TASK 문서 작성       (docs/리뷰/TASKS.md 에 🔜 대기 항목 추가)
  ↓
[2] Tests 먼저 작성      (TDD)
  ↓
[3] 구현                 (tests green 될 때까지)
  ↓
[4] test-coverage 확인   (변경 파일 ≥ 80%)
  ↓
[5] 코드 리뷰            (`npm run harness:review -- --task T-XXX --auto`)
  ↓
[6] TASK 상태 업데이트   (🔜 → ⏳ → ✅)
  ↓
[7] `npm run build`       (하네스가 위 전부 검증)
```

---

## 하네스 구성

### 5개 Gate

| Gate | 체크 | 실패 시 |
|---|---|---|
| **G1 TASK Ref** | 커밋 메시지에 `T-NNN` 또는 `WO-#N` 패턴 | Build FAIL |
| **G2 Test Existence** | 변경된 `src/lib/**/*.ts` 에 대응 테스트 파일 존재 | Build FAIL |
| **G3 Coverage** | 변경 파일 커버리지 ≥ 80% (vitest) | Build FAIL |
| **G4 Review** | `.harness/review-log.jsonl` 에 리뷰 기록 | Build FAIL |
| **G5 TASK Status** | TASKS.md 에 참조 TASK 존재 + `⏳`/`✅` 상태 | Build FAIL |

### 파일 구조

```
.harness/
├── config.json              # 임계값·제외 패턴
└── review-log.jsonl         # 리뷰 기록 (append-only)

scripts/harness/
├── check.ts                 # CLI 진입점 (모든 gate 실행)
├── record-review.ts         # 리뷰 기록 CLI
├── hooks/commit-msg.ts      # Git commit-msg 훅
├── gates/
│   ├── task-ref.ts
│   ├── test-existence.ts
│   ├── coverage.ts
│   ├── review.ts
│   └── task-status.ts
├── util/
│   ├── git.ts
│   ├── config.ts
│   ├── glob.ts
│   └── logger.ts
└── __tests__/               # 각 gate TDD 테스트

.husky/
├── commit-msg               # TASK 참조 검증
├── pre-commit               # 하네스 유닛 테스트
└── pre-push                 # `npm run harness:check`
```

---

## 명령어

### 하네스 체크 실행
```bash
npm run harness:check
```
`npm run build` 는 자동으로 이 체크를 먼저 실행.

### 리뷰 기록
```bash
# 변경된 src/lib 파일 자동 감지 (권장)
npm run harness:review -- --task T-001 --auto

# 특정 파일 수동 지정
npm run harness:review -- --task T-001 --files src/lib/data.ts,src/lib/format/rating.ts

# 노트 추가
npm run harness:review -- --task T-001 --auto --notes "edge case 처리, 리팩터 명확"
```

### 우회 (긴급 배포 전용, 비권장)
```bash
SKIP_HARNESS=1 npm run build              # 전체 우회
HARNESS_SKIP=coverage npm run harness:check  # 특정 gate만
```

---

## 커밋 메시지 규칙

모든 커밋은 다음 중 하나를 포함해야 함:

- `T-NNN` — TASKS.md 항목 참조 (3자리 숫자)
- `WO-#N` — WORK_ORDER 항목 참조

### 예시

```
feat: T-001 remove ghost dermatology entries
fix: T-008 AggregateRating standalone schema bug (WO-#11)
refactor: T-021 Naver blog search client
docs: WO-#45 update multi-source data enrichment plan
```

### 자동 거부되는 경우

- `fix: some change` — TASK 참조 없음
- `update` — 짧고 의미 없음
- `T-1` — 3자리 숫자 아님

### 우회 (비권장)

```bash
git commit --no-verify -m "hotfix: emergency patch"
```

---

## TASK 상태 규칙

`docs/리뷰/TASKS.md` 에 각 TASK 헤딩은 상태 마커 포함:

- `🔜 대기` — 착수 전
- `⏳ 진행` — 작업 중
- `✅ 완료` — PR 머지됨
- (마커 없음 → `unknown` 으로 간주, 빌드 실패)

### 예시

```markdown
## T-001. 수피부과 전면 제거 ✅

## T-002. 카니발라이제이션 해소 ⏳

## T-003. 숫자 단일 소스 🔜
```

커밋이 `T-001` 을 참조하는데 TASKS.md 의 T-001 이 `🔜` 상태면 빌드 실패 → 먼저 `⏳` 로 갱신 후 작업.

---

## 제외 규칙

`.harness/config.json` 의 `excludePatterns` 에 정의:

- **G2 test-existence 제외**:
  - `src/lib/types.ts` (타입만)
  - `src/lib/constants.ts`
  - `src/lib/supabase/**` (DB 클라이언트 설정)
  - `src/lib/supabase-types.ts` (DB 타입)

- **G3 coverage 제외**:
  - 동일 + 모든 `__tests__/**`

- **모든 gate 제외** (`buildExcludeFromAll`):
  - `src/app/**/page.tsx` (Next.js 프레임워크 파일)
  - `src/app/**/layout.tsx`
  - `src/app/**/opengraph-image.tsx`
  - `src/app/sitemap.ts`, `robots.ts`, `manifest.ts`
  - `src/components/**` (UI — 통합 테스트로 커버)
  - `middleware.ts`

**새 파일 추가 시** 제외 필요하면 `.harness/config.json` 편집.

---

## 새 TASK 시작하기

1. `docs/리뷰/TASKS.md` 에 항목 추가
   ```markdown
   ## T-100. 새로운 기능 🔜

   **WO 참조**: #N
   **축**: GEO
   **예상 공수**: 2h

   **DoD**
   - [ ] ...
   ```

2. 상태를 `🔜 → ⏳` 로 변경

3. **Tests 먼저 작성**
   ```bash
   # 신규 파일: src/lib/format/hours.ts
   # 테스트: src/lib/__tests__/format/hours.test.ts
   ```

4. 구현 → `npm test` green

5. 리뷰 기록
   ```bash
   npm run harness:review -- --task T-100 --auto --notes "초기 구현"
   ```

6. TASK 상태 `⏳ → ✅`

7. 커밋
   ```bash
   git commit -m "feat: T-100 add hours format utility"
   ```

8. `npm run build` 통과 확인

---

## 트러블슈팅

### "Commit message must contain a TASK reference"
→ 커밋 메시지에 `T-NNN` 또는 `WO-#N` 추가.

### "coverage file not found"
→ `npm test` 를 최소 한 번 실행했는지 확인. `coverage/coverage-summary.json` 생성 필요.

### "no review record for file X"
→ `npm run harness:review -- --task T-XXX --files <path>` 실행.

### "TASK T-XXX not in doc"
→ `docs/리뷰/TASKS.md` 에 해당 TASK 항목 추가.

### "TASK T-XXX is still 🔜 pending"
→ 작업 시작 시 `⏳` 로 변경, 완료 후 `✅` 로 변경.

### 하네스 자체 수정 시
`scripts/harness/**` 은 `buildExcludeFromAll` 에 포함돼 자체 검증 회피.
단 `scripts/harness/__tests__/` 는 유지보수 책임 있음 — 변경 시 테스트 같이 업데이트.
