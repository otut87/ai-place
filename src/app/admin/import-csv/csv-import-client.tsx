'use client'

import { useState } from 'react'
import { importCsvPlaces, type CsvImportResponse } from '@/lib/actions/import-csv-places'
import { summarizeImport, CSV_TEMPLATE_HEADERS } from '@/lib/admin/csv-import'

const TEMPLATE = [
  CSV_TEMPLATE_HEADERS.join(','),
  '수피부과,cheonan,dermatology,su-dermatology,"충남 천안시 동남구 ...",041-555-1234,천안 피부과 전문 클리닉입니다.,"여드름,레이저"',
].join('\n')

export function CsvImportClient() {
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<CsvImportResponse | null>(null)

  async function onFile(file: File) {
    const content = await file.text()
    setText(content)
  }

  async function submit() {
    if (!text.trim()) return
    setPending(true)
    setResult(null)
    try {
      const r = await importCsvPlaces(text)
      setResult(r)
    } catch (e) {
      setResult({
        success: false,
        error: String((e as Error)?.message ?? e),
        results: [],
        successCount: 0,
        failureCount: 0,
      })
    }
    setPending(false)
  }

  function loadTemplate() {
    setText(TEMPLATE)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="inline-flex h-10 px-4 items-center rounded-lg border border-[#dddddd] bg-white text-sm cursor-pointer">
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
            }}
          />
          파일 선택
        </label>
        <button
          type="button"
          onClick={loadTemplate}
          className="h-10 px-4 rounded-lg border border-[#dddddd] bg-white text-sm"
        >
          템플릿 불러오기
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="CSV 내용을 여기에 붙여넣거나 파일을 선택하세요."
        className="w-full min-h-64 p-3 rounded-lg border border-[#dddddd] bg-white text-sm font-mono"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={pending || !text.trim()}
          className="h-11 px-6 rounded-lg bg-[#222222] text-white text-sm font-medium disabled:opacity-50"
        >
          {pending ? '등록 중...' : '가져오기'}
        </button>
        {result && (
          <span className="text-sm text-[#484848]">
            {summarizeImport({ success: result.successCount, failed: result.failureCount })}
          </span>
        )}
      </div>

      {result?.error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{result.error}</div>
      )}

      {result && result.results.length > 0 && (
        <div className="rounded-xl border border-[#dddddd] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-[#484848]">
              <tr>
                <th className="px-3 py-2 text-left">행</th>
                <th className="px-3 py-2 text-left">업체명</th>
                <th className="px-3 py-2 text-left">결과</th>
                <th className="px-3 py-2 text-left">메시지</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((r) => (
                <tr key={r.rowNumber} className="border-t border-[#eeeeee]">
                  <td className="px-3 py-2 text-[#6a6a6a]">{r.rowNumber}</td>
                  <td className="px-3 py-2">{r.name || '(이름 없음)'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {r.ok ? '성공' : '실패'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#6a6a6a]">
                    {r.errors.length > 0 ? r.errors.join(' · ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
