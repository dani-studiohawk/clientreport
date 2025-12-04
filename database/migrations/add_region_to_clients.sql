-- Add region column to clients table to track which board/country they're from
-- Possible values: 'AU', 'US', 'UK'

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS region TEXT;

-- Create an index for filtering by region
CREATE INDEX IF NOT EXISTS idx_clients_region ON clients(region);

-- Add a comment explaining the field
COMMENT ON COLUMN clients.region IS 'Board region/country code (AU, US, UK) indicating which Monday.com board the client is from.';
