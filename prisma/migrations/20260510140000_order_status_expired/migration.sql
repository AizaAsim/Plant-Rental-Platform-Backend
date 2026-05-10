-- Automated expiry (slot / payment window / unpaid checkout) — terminal state distinct from user CANCELLED
ALTER TYPE "OrderStatus" ADD VALUE 'EXPIRED';
