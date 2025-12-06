-- Migration: Add contract_length field to clients table
-- Date: 2025-12-06

ALTER TABLE public.clients
ADD COLUMN contract_length text;

COMMENT ON COLUMN public.clients.contract_length IS 'Contract length type from Monday.com (e.g., "Ongoing", "6 months", "12 months")';
