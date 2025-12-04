-- Add tags column to time_entries table for flagging special cases
-- like post-sprint work, unassigned work, etc.

ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create an index for faster tag queries
CREATE INDEX IF NOT EXISTS idx_time_entries_tags ON time_entries USING GIN(tags);

-- Add a comment explaining the tags field
COMMENT ON COLUMN time_entries.tags IS 'Array of tags for categorizing time entries. Examples: post_sprint_work, unassigned, overtime, etc.';
