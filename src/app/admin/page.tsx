// T-064 — /admin 운영 대시보드
import { AdminLink } from '@/components/admin/admin-link'
import { requireAuth } from '@/lib/auth'
import { getDashboardMetrics, getRecentActivity, dashboardIssuesCount } from '@/lib/admin/dashboard-metrics'
import { summarizeAction, actorTypeLabel, type AuditAction, type ActorType } from '@/lib/admin/audit'
import { ClipboardCheck, Megaphone, ActivitySquare, CreditCardIcon, User, Bot, Cog } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  await requireAuth()
  const [metrics, activity] = await Promise.all([
    getDashboardMetrics(),
    getRecentActivity(15),
  ])
  const totalIssues = dashboardIssuesCount(metrics)

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-[#222222]">운영 대시보드</h1>
        <p className="mt-0.5 text-xs text-[#6a6a6a]">
          오늘 처리 대기 {totalIssues}건 · 활성 업체 {metrics.activePlaces}개
        </p>
      </header>

      {/* 액션 카드 4개 */}
      <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          href="/admin/review"
          icon={<ClipboardCheck className="h-5 w-5" />}
          label="검수 대기"
          count={metrics.pendingPlaces}
          tone="purple"
          detail="업체 검수 큐로 이동"
        />
        <ActionCard
          href="/admin/blog"
          icon={<Megaphone className="h-5 w-5" />}
          label="오늘 발행 예정"
          count={metrics.publishedToday}
          tone="green"
          detail="블로그 캘린더 (T-078 예정)"
        />
        <ActionCard
          href="/admin/pipelines"
          icon={<ActivitySquare className="h-5 w-5" />}
          label="실패한 작업"
          count={metrics.pipelineFailures}
          tone="yellow"
          detail="자동화 파이프라인 (T-076 예정)"
        />
        <ActionCard
          href="/admin/billing/failures"
          icon={<CreditCardIcon className="h-5 w-5" />}
          label="결제 이슈"
          count={metrics.billingFailures + metrics.billingExpiringSoon}
          tone="red"
          detail="실패·카드 만료임박 (T-073 예정)"
        />
      </section>

      {/* 중단 지표 요약 */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="활성 업체" value={metrics.activePlaces} />
        <Stat label="Pending" value={metrics.pendingPlaces} />
        <Stat label="Rejected" value={metrics.rejectedPlaces} />
        <Stat label="MRR (₩)" value={0} placeholder="T-070 이후" />
      </section>

      {/* 최근 활동 로그 */}
      <section className="rounded-lg border border-[#e5e7eb] bg-white">
        <header className="flex items-center justify-between border-b border-[#f3f4f6] px-4 py-2">
          <h2 className="text-sm font-semibold text-[#222222]">최근 활동</h2>
          <span className="text-xs text-[#6a6a6a]">최신 15건 · 사람/자동화 구분</span>
        </header>
        {activity.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#6a6a6a]">아직 기록된 활동이 없습니다.</p>
        ) : (
          <ol className="divide-y divide-[#f3f4f6]">
            {activity.map(e => (
              <li key={e.id} className="flex items-center justify-between px-4 py-2 text-xs">
                <span className="flex items-center gap-2">
                  <ActorIcon type={(e.actor_type as ActorType) ?? 'human'} />
                  <span className="text-[#222222]">
                    {summarizeAction(e.action as AuditAction, { field: e.field ?? undefined })}
                  </span>
                  {e.place_id && (
                    <AdminLink href={`/admin/places/${e.place_id}/history`} className="text-[#4c1d95] underline">
                      이력 보기
                    </AdminLink>
                  )}
                </span>
                <time className="text-[#6a6a6a]">{new Date(e.created_at).toLocaleString('ko-KR')}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function ActionCard({
  href, icon, label, count, tone, detail,
}: {
  href: string
  icon: React.ReactNode
  label: string
  count: number
  tone: 'purple' | 'green' | 'yellow' | 'red'
  detail: string
}) {
  const toneCls = {
    purple: 'border-[#ddd6fe] bg-[#f5f3ff] text-[#4c1d95]',
    green: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#065f46]',
    yellow: 'border-[#fde68a] bg-[#fffbeb] text-[#854d0e]',
    red: 'border-[#fca5a5] bg-[#fef2f2] text-[#991b1b]',
  }[tone]
  return (
    <AdminLink
      href={href}
      className={`block rounded-lg border p-4 transition-shadow hover:shadow-sm ${toneCls}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold">{count}</p>
      <p className="mt-0.5 text-[10px] opacity-75">{detail}</p>
    </AdminLink>
  )
}

function Stat({ label, value, placeholder }: { label: string; value: number; placeholder?: string }) {
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white p-3">
      <p className="text-[10px] uppercase text-[#6a6a6a]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#222222]">{value.toLocaleString()}</p>
      {placeholder && <p className="text-[10px] text-[#9ca3af]">{placeholder}</p>}
    </div>
  )
}

function ActorIcon({ type }: { type: ActorType }) {
  const cls = 'inline-flex h-4 w-4 items-center justify-center rounded-full'
  if (type === 'pipeline') return <span className={`${cls} bg-[#ede9fe] text-[#4c1d95]`} title={actorTypeLabel(type)}><Bot className="h-2.5 w-2.5" /></span>
  if (type === 'system') return <span className={`${cls} bg-[#f3f4f6] text-[#484848]`} title={actorTypeLabel(type)}><Cog className="h-2.5 w-2.5" /></span>
  return <span className={`${cls} bg-[#e6f7f1] text-[#00a67c]`} title={actorTypeLabel(type)}><User className="h-2.5 w-2.5" /></span>
}
