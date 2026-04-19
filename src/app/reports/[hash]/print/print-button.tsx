'use client'

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{ background: 'white', color: '#191919', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
    >
      PDF 로 저장 (Ctrl+P)
    </button>
  )
}
