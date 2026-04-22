// /owner 홈 — 할 일 패널. 업체명 highlight + priority pill + 시작 링크.

import Link from 'next/link'
import type { OwnerTodo } from '@/lib/owner/todos'

interface Props {
  todos: OwnerTodo[]
}

/** "다두 — 대표 사진 부족" 같은 타이틀에서 첫 토큰(업체명)을 .biz-n 으로 분리. */
function splitTitle(title: string): { name: string; rest: string } {
  const m = title.match(/^(.+?)\s[—-]\s(.+)$/)
  if (m) return { name: m[1], rest: m[2] }
  return { name: '', rest: title }
}

export function DashTodoCard({ todos }: Props) {
  return (
    <div className="dash-panel2 todo-card">
      <div className="phead">
        <h3>할 일 · {todos.length}건</h3>
        {todos.length > 0 && <span className="sort">우선순위 자동 정렬</span>}
      </div>

      {todos.length === 0 ? (
        <div className="todo-empty">
          🎉 할 일이 모두 끝났어요.<br />
          AI 노출 데이터가 쌓이는 동안 새 업체를 추가해 보세요.
        </div>
      ) : (
        <div className="list">
          {todos.slice(0, 8).map((t, idx) => {
            const parts = splitTitle(t.title)
            return (
              <div key={`${t.id}-${idx}`} className="todo-item">
                <div className="num">{idx + 1}</div>
                <div className="body">
                  <b>
                    {parts.name && <span className="biz-n">{parts.name}</span>}
                    {parts.name ? ' — ' : ''}{parts.rest}
                  </b>
                  <span>{t.description}</span>
                  {t.actionHref && (
                    <Link href={t.actionHref} className="start">시작하기 →</Link>
                  )}
                </div>
                <span className={`pri ${t.priority}`}>{t.priority}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
