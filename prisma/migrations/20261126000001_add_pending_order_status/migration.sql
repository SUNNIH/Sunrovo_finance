-- Add PENDING status for linked Stop Loss and Take Profit orders.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'OPEN';
