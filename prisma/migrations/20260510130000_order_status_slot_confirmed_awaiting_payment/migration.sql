-- Explicit slot lifecycle: customer locked slot → checkout / payment queue
ALTER TYPE "OrderStatus" ADD VALUE 'SLOT_CONFIRMED';
ALTER TYPE "OrderStatus" ADD VALUE 'AWAITING_PAYMENT';
