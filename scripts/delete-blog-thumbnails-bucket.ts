#!/usr/bin/env tsx
// Supabase Storage 'blog-thumbnails' 버킷 삭제.
//
// 사용:
//   tsx scripts/delete-blog-thumbnails-bucket.ts          # 리스팅만
//   tsx scripts/delete-blog-thumbnails-bucket.ts --execute # 실제 삭제
//
// Supabase 는 비어있는 버킷만 drop 가능하므로: (1) 파일 일괄 삭제 → (2) 버킷 삭제.
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { getAdminClient } from '../src/lib/supabase/admin-client'

const BUCKET = 'blog-thumbnails'

async function main() {
  const execute = process.argv.includes('--execute')
  const admin = getAdminClient()
  if (!admin) {
    console.error('❌ admin client 미초기화 — .env.local 의 SUPABASE_SERVICE_ROLE_KEY 확인')
    process.exit(1)
  }

  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  🗑  Supabase Storage '${BUCKET}' ${execute ? '삭제' : '리스팅 (dry-run)'}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  // 1) 버킷 존재 확인
  const { data: buckets, error: listErr } = await admin.storage.listBuckets()
  if (listErr) {
    console.error('❌ listBuckets 실패:', listErr.message)
    process.exit(1)
  }
  const target = buckets?.find((b) => b.name === BUCKET)
  if (!target) {
    console.log(`ℹ️  '${BUCKET}' 버킷이 이미 존재하지 않음 (삭제 완료 상태). 종료.`)
    return
  }
  console.log(`✓ 버킷 발견: name=${target.name}, public=${target.public}, created_at=${target.created_at}`)

  // 2) 파일 목록 (재귀로 1단계만)
  const { data: files, error: filesErr } = await admin.storage.from(BUCKET).list(undefined, {
    limit: 1000,
    offset: 0,
  })
  if (filesErr) {
    console.error('❌ list 실패:', filesErr.message)
    process.exit(1)
  }

  const fileList = files ?? []
  const totalBytes = fileList.reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0)
  console.log(`\n📁 파일 ${fileList.length}개, 총 ${(totalBytes / 1024).toFixed(0)}KB`)
  for (const f of fileList.slice(0, 20)) {
    console.log(`   · ${f.name}  (${((f.metadata?.size ?? 0) / 1024).toFixed(0)}KB)`)
  }
  if (fileList.length > 20) console.log(`   · ... 그 외 ${fileList.length - 20}개`)

  if (!execute) {
    console.log(`\n💡 실제 삭제하려면 --execute 플래그로 다시 실행하세요.`)
    return
  }

  // 3) 파일 일괄 삭제
  if (fileList.length > 0) {
    console.log(`\n⏳ 파일 ${fileList.length}개 삭제 중…`)
    const paths = fileList.map((f) => f.name)
    const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths)
    if (rmErr) {
      console.error('❌ 파일 삭제 실패:', rmErr.message)
      process.exit(1)
    }
    console.log(`✓ 파일 ${fileList.length}개 삭제됨`)
  }

  // 4) 버킷 삭제
  console.log(`\n⏳ 버킷 '${BUCKET}' drop 중…`)
  const { error: dropErr } = await admin.storage.deleteBucket(BUCKET)
  if (dropErr) {
    console.error('❌ 버킷 삭제 실패:', dropErr.message)
    process.exit(1)
  }
  console.log(`✓ 버킷 '${BUCKET}' 삭제됨`)

  // 5) 검증 — 재조회 시 사라져야 함
  const { data: after } = await admin.storage.listBuckets()
  const stillExists = after?.some((b) => b.name === BUCKET)
  if (stillExists) {
    console.error('⚠️ 삭제 후에도 버킷이 조회됨 — Supabase 상태 확인 필요')
    process.exit(1)
  }
  console.log(`\n═══════════════════════════════════════════════════════════`)
  console.log(`  ✅ 완료 — '${BUCKET}' 버킷 완전 삭제`)
  console.log(`═══════════════════════════════════════════════════════════`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
