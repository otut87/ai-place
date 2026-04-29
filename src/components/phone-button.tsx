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
      className="btn accent"
    >
      전화하기
    </a>
  )
}
