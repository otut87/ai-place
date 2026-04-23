-- T-223 — 결제 영수증 URL 저장.
--
-- Toss charge API 응답의 receipts.url 을 payments.receipt_url 에 저장.
-- 오너 빌링 페이지 결제 이력 각 row 에 "영수증 ↗" 링크로 노출 — 소상공인 비용처리 근거.

alter table payments
  add column if not exists receipt_url text;
