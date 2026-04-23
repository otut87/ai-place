'use client'

// T-210 — 업체 카드 액션: 보관/복원 버튼 + 확인 다이얼로그.
// archiveOwnerPlace / restoreOwnerPlace server action 호출 + 결과에 따라 refresh.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { archiveOwnerPlace, restoreOwnerPlace } from '@/lib/actions/owner-places'
import { PLAN_AMOUNT_PER_PLACE } from '@/lib/billing/types'

interface Props {
  placeId: string
  placeName: string
  status: 'active' | 'archived' | 'pending' | 'rejected' | 'other'
}

export function PlaceRowActions({ placeId, placeName, status }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState<'archive' | 'restore' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canArchive = status === 'active'
  const canRestore = status === 'archived'
  if (!canArchive && !canRestore) return null

  function handleConfirm() {
    if (!confirming) return
    setError(null)
    startTransition(async () => {
      try {
        const result = confirming === 'archive'
          ? await archiveOwnerPlace(placeId)
          : await restoreOwnerPlace(placeId)
        if (!result.success) {
          setError(result.error ?? '처리에 실패했습니다.')
          return
        }
        setConfirming(null)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'unknown error')
      }
    })
  }

  const currentMonthDelta = PLAN_AMOUNT_PER_PLACE.toLocaleString('ko-KR')

  return (
    <>
      {canArchive && (
        <button
          type="button"
          className="btn ghost sm danger-btn"
          onClick={() => setConfirming('archive')}
          disabled={pending}
        >
          보관
        </button>
      )}
      {canRestore && (
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => setConfirming('restore')}
          disabled={pending}
        >
          복원
        </button>
      )}

      {confirming && (
        <div className="row-confirm-backdrop" onClick={() => !pending && setConfirming(null)}>
          <div className="row-confirm" onClick={(e) => e.stopPropagation()}>
            <h4>
              {confirming === 'archive' ? `"${placeName}" 을 보관할까요?` : `"${placeName}" 을 복원할까요?`}
            </h4>
            <ul>
              {confirming === 'archive' ? (
                <>
                  <li>· 공개 페이지 <b>(aiplace.kr)</b> 에서 비노출 처리됩니다.</li>
                  <li>· 다음 결제일부터 월 <b>₩{currentMonthDelta}</b> 만큼 감액됩니다.</li>
                  <li>· 언제든 &ldquo;복원&rdquo; 으로 되돌릴 수 있어요 — 데이터는 보존됩니다.</li>
                  <li>· 이번 달 이미 발행된 블로그 글은 그대로 유지됩니다.</li>
                </>
              ) : (
                <>
                  <li>· 공개 페이지가 다시 노출됩니다.</li>
                  <li>· 다음 결제일부터 월 <b>₩{currentMonthDelta}</b> 추가 청구됩니다.</li>
                </>
              )}
            </ul>
            {error && <div className="err">⚠️ {error}</div>}
            <div className="actions">
              <button
                type="button"
                className="btn ghost"
                disabled={pending}
                onClick={() => setConfirming(null)}
              >
                취소
              </button>
              <button
                type="button"
                className={`btn ${confirming === 'archive' ? 'danger' : 'accent'}`}
                disabled={pending}
                onClick={handleConfirm}
              >
                {pending ? '처리 중...' : confirming === 'archive' ? '보관하기' : '복원하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .danger-btn { color: var(--bad, #b91c1c); }
        .danger-btn:hover { background: color-mix(in oklab, var(--bad, #b91c1c) 8%, transparent) !important; }

        .row-confirm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.35);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }
        .row-confirm {
          max-width: 480px;
          width: 100%;
          background: var(--card, #fff);
          border-radius: var(--r-lg, 14px);
          padding: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,.2);
        }
        .row-confirm h4 { margin: 0 0 12px; font-size: 16px; font-weight: 600; }
        .row-confirm ul { margin: 0 0 16px; padding: 0; list-style: none; font-size: 13px; line-height: 1.7; color: var(--ink-soft, #444); }
        .row-confirm b { color: var(--ink, #191919); }
        .row-confirm .err {
          margin-bottom: 12px;
          padding: 10px;
          background: color-mix(in oklab, var(--bad, #b91c1c) 10%, transparent);
          border-radius: 6px;
          color: var(--bad, #b91c1c);
          font-size: 12px;
        }
        .row-confirm .actions { display: flex; justify-content: flex-end; gap: 8px; }
        .row-confirm .btn {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid var(--line-2, #e7e5e1);
          background: var(--card, #fff);
          color: var(--ink, #191919);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .row-confirm .btn.danger {
          background: var(--bad, #b91c1c);
          color: #fff;
          border-color: var(--bad, #b91c1c);
        }
        .row-confirm .btn.accent {
          background: var(--ink, #0f0f0f);
          color: #fff;
          border-color: var(--ink, #0f0f0f);
        }
        .row-confirm .btn:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>
    </>
  )
}
