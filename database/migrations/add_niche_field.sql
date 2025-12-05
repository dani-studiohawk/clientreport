-- Add niche field to clients table
-- This field stores the client's industry/niche from Monday.com

ALTER TABLE clients ADD COLUMN IF NOT EXISTS niche TEXT;

-- Add comment
COMMENT ON COLUMN clients.niche IS 'Client industry or niche (from Monday.com Niche column)';
