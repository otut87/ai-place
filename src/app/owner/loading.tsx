// /owner 공통 로딩 스켈레톤 — 클릭 즉시 반응 보장 (Next.js App Router loading.tsx).
// 오너 대시보드 레이아웃과 동일한 grid 구조로 스켈레톤 블록을 배치한다.

export default function OwnerLoading() {
  return (
    <div className="dash-page" aria-busy="true" aria-live="polite">
      <div className="sk-hero" />
      <div className="sk-sec" />
      <div className="sk-chart" />
      <div className="sk-kpi2">
        <div className="sk-card" />
        <div className="sk-card" />
      </div>
      <div className="sk-sec" />
      <div className="sk-biz">
        <div className="sk-card sk-card-tall" />
        <div className="sk-card sk-card-tall" />
      </div>

      <style>{`
        .sk-hero,
        .sk-sec,
        .sk-chart,
        .sk-card {
          background: linear-gradient(
            90deg,
            color-mix(in oklab, var(--line-2, #e7e5e1) 80%, transparent),
            color-mix(in oklab, var(--line-2, #e7e5e1) 40%, transparent),
            color-mix(in oklab, var(--line-2, #e7e5e1) 80%, transparent)
          );
          background-size: 200% 100%;
          border-radius: var(--r-lg, 16px);
          animation: sk-shimmer 1.4s infinite linear;
        }
        .sk-hero  { height: 220px; margin-bottom: 24px; }
        .sk-sec   { height: 36px;  margin: 32px 0 16px; max-width: 320px; }
        .sk-chart { height: 280px; margin-bottom: 24px; }
        .sk-kpi2  { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .sk-biz   { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .sk-card  { height: 160px; }
        .sk-card-tall { height: 320px; }
        @media (max-width: 768px) {
          .sk-kpi2, .sk-biz { grid-template-columns: 1fr; }
        }
        @keyframes sk-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sk-hero, .sk-sec, .sk-chart, .sk-card { animation: none; }
        }
      `}</style>
    </div>
  )
}
