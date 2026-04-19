'use server'

// T-128 — 프롬프트 템플릿 활성화 서버 액션 (admin 전용).

import { requireAuthForAction } from '@/lib/auth'
import { activatePromptVersion as activateCore } from '@/lib/admin/prompt-templates'
import { revalidatePath } from 'next/cache'

export async function activatePromptAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAuthForAction()
  const r = await activateCore(id)
  if (r.success) revalidatePath('/admin/prompts')
  return r
}
