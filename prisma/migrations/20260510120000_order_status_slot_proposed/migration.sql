-- Phase 06: vendor proposed delivery slots before payment — distinct order status
ALTER TYPE "OrderStatus" ADD VALUE 'SLOT_PROPOSED';
