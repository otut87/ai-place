'use client'

// 리포트 HTML 을 iframe 에 srcDoc 로 주입.
// 인쇄(window print) / HTML 내려받기 2개 액션 제공.

import { useRef } from 'react'

interface Props {
  html: string
  downloadFilename: string
}

export function ReportViewer({ html, downloadFilename }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  function handlePrint() {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.focus()
    win.print()
  }

  function handleDownload() {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <button type="button" className="btn ghost sm" onClick={handleDownload}>
          ⬇︎ HTML 내려받기
        </button>
        <button type="button" className="btn accent sm" onClick={handlePrint}>
          🖨 인쇄 · PDF 저장
        </button>
      </div>

      <div
        style={{
          border: '1px solid var(--line)',
          borderRadius: 'var(--r)',
          overflow: 'hidden',
          background: 'var(--bg)',
        }}
      >
        <iframe
          ref={iframeRef}
          title="월간 리포트 미리보기"
          srcDoc={html}
          sandbox="allow-same-origin allow-modals allow-popups"
          style={{
            width: '100%',
            height: 760,
            border: 'none',
            display: 'block',
          }}
        />
      </div>
    </div>
  )
}
