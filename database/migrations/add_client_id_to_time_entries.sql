-- Add client_id column to time_entries table for direct client linkage
-- This makes it easier to query time entries by client without going through sprints

-- Add the column
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Create an index for faster client queries
CREATE INDEX IF NOT EXISTS idx_time_entries_client ON time_entries(client_id);

-- Add a comment explaining the field
COMMENT ON COLUMN time_entries.client_id IS 'Direct reference to client. Populated during sync by matching project_name to client. Makes querying post-sprint work easier.';

-- Backfill client_id for existing entries by matching project_name to client name
-- This will link all the post-sprint work entries to their clients
UPDATE time_entries te
SET client_id = c.id
FROM clients c
WHERE te.client_id IS NULL
  AND te.project_name IS NOT NULL
  AND LOWER(TRIM(te.project_name)) = LOWER(TRIM(c.name));

-- Show results
DO $$
DECLARE
    total_entries INTEGER;
    linked_entries INTEGER;
    unlinked_entries INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_entries FROM time_entries;
    SELECT COUNT(*) INTO linked_entries FROM time_entries WHERE client_id IS NOT NULL;
    SELECT COUNT(*) INTO unlinked_entries FROM time_entries WHERE client_id IS NULL;

    RAISE NOTICE 'Migration complete!';
    RAISE NOTICE 'Total time entries: %', total_entries;
    RAISE NOTICE 'Linked to clients: %', linked_entries;
    RAISE NOTICE 'Unlinked: %', unlinked_entries;
END $$;
