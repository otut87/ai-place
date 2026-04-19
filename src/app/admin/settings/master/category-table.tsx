'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save } from 'lucide-react'
import { upsertCategoryAction, deleteCategoryAction } from '@/lib/actions/master-data'
import { useToast } from '@/components/admin/toast'

interface CategoryRow { slug: string; name: string; name_en: string; icon: string | null; sector: string }
interface SectorOpt { slug: string; name: string }

export function CategoryTable({ rows, sectors }: { rows: CategoryRow[]; sectors: SectorOpt[] }) {
  const [pending, start] = useTransition()
  const toast = useToast()
  const router = useRouter()
  const [filterSector, setFilterSector] = useState<string>('all')
  const [newSlug, setNewSlug] = useState('')
  const [newName, setNewName] = useState('')
  const [newNameEn, setNewNameEn] = useState('')
  const [newSector, setNewSector] = useState(sectors[0]?.slug ?? 'living')
  const [newIcon, setNewIcon] = useState('')

  const filtered = useMemo(
    () => filterSector === 'all' ? rows : rows.filter(r => r.sector === filterSector),
    [rows, filterSector],
  )

  function save(slug: string, payload: { name: string; nameEn: string; sector: string; icon: string | null }) {
    start(async () => {
      const r = await upsertCategoryAction({ slug, ...payload })
      if (r.success) { toast.success('저장됨'); router.refresh() }
      else toast.error(r.error ?? '저장 실패')
    })
  }

  function remove(slug: string) {
    if (!confirm(`"${slug}" 삭제?`)) return
    start(async () => {
      const r = await deleteCategoryAction(slug)
      if (r.success) { toast.success('삭제됨'); router.refresh() }
      else toast.error(r.error ?? '삭제 실패')
    })
  }

  return (
    <div>
      <div className="mb-3">
        <select
          value={filterSector}
          onChange={e => setFilterSector(e.target.value)}
          className="h-9 rounded-md border border-[#e7e7e7] bg-white px-2 text-sm"
        >
          <option value="all">전체 섹터</option>
          {sectors.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wider text-[#6b6b6b]">
            <tr>
              <th className="px-4 py-3 font-medium">slug</th>
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">영문</th>
              <th className="px-4 py-3 font-medium">섹터</th>
              <th className="px-4 py-3 font-medium">아이콘</th>
              <th className="px-4 py-3 font-medium w-24">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {filtered.map(row => (
              <CategoryRowInline key={row.slug} row={row} sectors={sectors} pending={pending} onSave={save} onDelete={remove} />
            ))}
            <tr>
              <td className="px-4 py-3">
                <input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="new-slug" className="h-8 w-full rounded border border-[#e7e7e7] px-2 text-sm" />
              </td>
              <td className="px-4 py-3">
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="이름" className="h-8 w-full rounded border border-[#e7e7e7] px-2 text-sm" />
              </td>
              <td className="px-4 py-3">
                <input value={newNameEn} onChange={e => setNewNameEn(e.target.value)} placeholder="English" className="h-8 w-full rounded border border-[#e7e7e7] px-2 text-sm" />
              </td>
              <td className="px-4 py-3">
                <select value={newSector} onChange={e => setNewSector(e.target.value)} className="h-8 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm">
                  {sectors.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                </select>
              </td>
              <td className="px-4 py-3">
                <input value={newIcon} onChange={e => setNewIcon(e.target.value)} placeholder="Stethoscope" className="h-8 w-full rounded border border-[#e7e7e7] px-2 text-sm" />
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  disabled={pending || !newSlug || !newName || !newSector}
                  onClick={() => {
                    save(newSlug, { name: newName, nameEn: newNameEn, sector: newSector, icon: newIcon || null })
                    setNewSlug(''); setNewName(''); setNewNameEn(''); setNewIcon('')
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-[#e7e7e7] bg-white px-2 py-1 text-xs hover:bg-[#fafafa] disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" /> 추가
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CategoryRowInline({
  row, sectors, pending, onSave, onDelete,
}: {
  row: CategoryRow
  sectors: SectorOpt[]
  pending: boolean
  onSave: (slug: string, payload: { name: string; nameEn: string; sector: string; icon: string | null }) => void
  onDelete: (slug: string) => void
}) {
  const [name, setName] = useState(row.name)
  const [nameEn, setNameEn] = useState(row.name_en)
  const [sector, setSector] = useState(row.sector)
  const [icon, setIcon] = useState(row.icon ?? '')
  const dirty = name !== row.name || nameEn !== row.name_en || sector !== row.sector || (icon || null) !== (row.icon ?? null)

  return (
    <tr>
      <td className="px-4 py-2 font-mono text-xs text-[#6b6b6b]">{row.slug}</td>
      <td className="px-4 py-2">
        <input value={name} onChange={e => setName(e.target.value)} className="h-8 w-full rounded border border-[#e7e7e7] px-2 text-sm" />
      </td>
      <td className="px-4 py-2">
        <input value={nameEn} onChange={e => setNameEn(e.target.value)} className="h-8 w-full rounded border border-[#e7e7e7] px-2 text-sm" />
      </td>
      <td className="px-4 py-2">
        <select value={sector} onChange={e => setSector(e.target.value)} className="h-8 w-full rounded border border-[#e7e7e7] bg-white px-2 text-sm">
          {sectors.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select>
      </td>
      <td className="px-4 py-2">
        <input value={icon} onChange={e => setIcon(e.target.value)} className="h-8 w-full rounded border border-[#e7e7e7] px-2 text-sm" />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pending || !dirty}
            onClick={() => onSave(row.slug, { name, nameEn, sector, icon: icon || null })}
            className="inline-flex items-center justify-center rounded-md border border-[#e7e7e7] bg-white p-1.5 text-[#191919] hover:bg-[#fafafa] disabled:opacity-40"
            aria-label="저장"
          >
            <Save className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onDelete(row.slug)}
            className="inline-flex items-center justify-center rounded-md border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-40"
            aria-label="삭제"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  )
}
