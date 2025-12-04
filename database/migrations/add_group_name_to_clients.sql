-- Add group_name column to clients table to track Monday.com group status
-- This helps identify which clients are active vs finished/refunded/etc.

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Create an index for filtering by group
CREATE INDEX IF NOT EXISTS idx_clients_group_name ON clients(group_name);

-- Add a comment explaining the field
COMMENT ON COLUMN clients.group_name IS 'Monday.com board group name (e.g., "Active", "Finished", "Refunded"). Used to determine client status.';
