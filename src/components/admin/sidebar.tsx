'use client'

// T-061 — 어드민 좌측 사이드바.
// 아이콘 + 라벨, 접기(localStorage 유지), 현재 라우트 활성 표시.

import { usePathname } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  LayoutDashboard,
  ListChecks,
  Building2,
  Notebook,
  Workflow,
  Radar,
  Users,
  CreditCard,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Flag,
  KeyRound,
} from 'lucide-react'
import { AdminLink } from './admin-link'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  group: 'main' | 'content' | 'ops' | 'crm' | 'settings'
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard, group: 'main' },
  { href: '/admin/review', label: '검수 큐', icon: ListChecks, group: 'main' },
  { href: '/admin/reports', label: '신고', icon: Flag, group: 'main' },
  { href: '/admin/claims', label: '소유권 문의', icon: KeyRound, group: 'main' },
  { href: '/admin/places', label: '업체', icon: Building2, group: 'content' },
  { href: '/admin/register', label: '신규 등록', icon: Sparkles, group: 'content' },
  { href: '/admin/blog', label: '블로그', icon: Notebook, group: 'content' },
  { href: '/admin/pipelines', label: '자동화', icon: Workflow, group: 'ops' },
  { href: '/admin/seo', label: 'SEO & AI 봇', icon: Radar, group: 'ops' },
  { href: '/admin/citations', label: 'AI 인용', icon: Radar, group: 'ops' },
  { href: '/admin/customers', label: '고객', icon: Users, group: 'crm' },
  { href: '/admin/billing/failures', label: '결제 실패', icon: CreditCard, group: 'crm' },
  { href: '/admin/billing/expiring', label: '만료 임박', icon: CreditCard, group: 'crm' },
  { href: '/admin/billing/history', label: '결제 이력', icon: CreditCard, group: 'crm' },
  { href: '/admin/billing/cancellations', label: '해지 예정', icon: CreditCard, group: 'crm' },
  { href: '/admin/settings', label: '설정', icon: Settings, group: 'settings' },
]

const COLLAPSE_KEY = 'admin_sidebar_collapsed'

export function Sidebar() {
  const pathname = usePathname() ?? '/admin'
  const [collapsed, setCollapsed] = useState(false)
  // Hydration 가드 — SSR=false, 클라이언트=true. setState-in-effect 회피.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage 기반 1회성 복원. SSR 마크업과 충돌하지 않도록 mount 후 동기화.
    if (localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true)
  }, [])

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
  }

  const width = collapsed ? 'w-14' : 'w-52'

  return (
    <aside className={`${width} shrink-0 border-r border-[#e5e7eb] bg-white transition-[width] duration-150`}>
      <div className="sticky top-0 flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[#f3f4f6] px-3 py-3">
          {!collapsed && <span className="text-sm font-semibold text-[#222222]">AI Place</span>}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            className="rounded p-1 text-[#6a6a6a] hover:bg-[#f3f4f6]"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {renderGroup(NAV_ITEMS.filter(n => n.group === 'main'), pathname, collapsed, mounted)}
          <Divider collapsed={collapsed} />
          {renderGroup(NAV_ITEMS.filter(n => n.group === 'content'), pathname, collapsed, mounted)}
          <Divider collapsed={collapsed} />
          {renderGroup(NAV_ITEMS.filter(n => n.group === 'ops'), pathname, collapsed, mounted)}
          <Divider collapsed={collapsed} />
          {renderGroup(NAV_ITEMS.filter(n => n.group === 'crm'), pathname, collapsed, mounted)}
          <Divider collapsed={collapsed} />
          {renderGroup(NAV_ITEMS.filter(n => n.group === 'settings'), pathname, collapsed, mounted)}
        </nav>
      </div>
    </aside>
  )
}

function renderGroup(items: NavItem[], pathname: string, collapsed: boolean, mounted: boolean) {
  return (
    <ul className="flex flex-col gap-0.5 px-2">
      {items.map(item => {
        const Icon = item.icon
        const active = isActive(pathname, item.href)
        return (
          <li key={item.href}>
            <AdminLink
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`group flex h-9 items-center gap-2 rounded-md px-2 text-sm transition-colors ${
                active
                  ? 'bg-[#e6f7f1] text-[#00a67c]'
                  : 'text-[#484848] hover:bg-[#f3f4f6]'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#00a67c]' : 'text-[#6a6a6a]'}`} />
              {(!collapsed || !mounted) && <span className="truncate">{item.label}</span>}
            </AdminLink>
          </li>
        )
      })}
    </ul>
  )
}

function Divider({ collapsed }: { collapsed: boolean }) {
  return <div className={`my-1.5 border-t border-[#f3f4f6] ${collapsed ? 'mx-2' : 'mx-3'}`} />
}

export function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}
