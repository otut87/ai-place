'use client'

import { trackPhoneClick } from './analytics'

interface PhoneButtonProps {
  phone: string
  businessName: string
}

export function PhoneButton({ phone, businessName }: PhoneButtonProps) {
  return (
    <a
      href={`tel:${phone}`}
      onClick={() => trackPhoneClick(businessName)}
      className="inline-flex h-12 px-6 items-center rounded-lg bg-[#008060] text-white font-medium hover:bg-[#006b4f] transition-colors"
    >
      전화하기
    </a>
  )
}
