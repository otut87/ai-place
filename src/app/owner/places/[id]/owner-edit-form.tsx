'use client'

// T-054 — 사장님 셀프 포털 편집 폼. description/phone/opening_hours/tags 만 수정.
import { useState, useTransition } from 'react'
import { updateOwnerPlace } from '@/lib/actions/owner-places'

interface Props {
  placeId: string
  initial: {
    description: string
    phone: string
    opening_hours: string[]
    tags: string[]
  }
}

export function OwnerEditForm({ placeId, initial }: Props) {
  const [description, setDescription] = useState(initial.description)
  const [phone, setPhone] = useState(initial.phone)
  const [hoursText, setHoursText] = useState(initial.opening_hours.join('\n'))
  const [tagsText, setTagsText] = useState(initial.tags.join(', '))
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setError(null)

    const patch: Record<string, unknown> = {}
    if (description !== initial.description) patch.description = description
    if (phone !== initial.phone) patch.phone = phone

    const nextHours = hoursText.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    if (nextHours.join('|') !== initial.opening_hours.join('|')) patch.opening_hours = nextHours

    const nextTags = tagsText.split(',').map(t => t.trim()).filter(Boolean)
    if (nextTags.join('|') !== initial.tags.join('|')) patch.tags = nextTags

    if (Object.keys(patch).length === 0) {
      setMessage('변경할 내용이 없습니다.')
      return
    }

    startTransition(async () => {
      const r = await updateOwnerPlace(placeId, patch)
      if (r.success) {
        setMessage(`${r.fieldsChanged}개 필드가 업데이트되었습니다.`)
      } else {
        setError(r.error ?? '업데이트 실패')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">소개 문구</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-[#dddddd] px-3 py-2 text-sm"
          placeholder="10자 이상 300자 이내"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">전화번호</label>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full rounded-md border border-[#dddddd] px-3 py-2 text-sm"
          placeholder="041-123-4567"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">영업시간 (한 줄에 하나)</label>
        <textarea
          value={hoursText}
          onChange={e => setHoursText(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-[#dddddd] px-3 py-2 font-mono text-xs"
          placeholder={"Mo-Fr 09:00-18:00\nSa 09:00-13:00"}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">태그 (쉼표로 구분, 최대 10개)</label>
        <input
          value={tagsText}
          onChange={e => setTagsText(e.target.value)}
          className="w-full rounded-md border border-[#dddddd] px-3 py-2 text-sm"
          placeholder="천안 피부과, 여드름, 리프팅"
        />
      </div>

      {message && <p className="text-xs text-green-700">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-md bg-[#222222] px-4 text-sm text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? '저장 중...' : '저장'}
      </button>
    </form>
  )
}
