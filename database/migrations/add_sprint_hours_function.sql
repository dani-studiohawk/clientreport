-- Function to get aggregated hours per sprint
-- This is much more efficient than fetching all time entries and aggregating in JS

CREATE OR REPLACE FUNCTION get_sprint_hours(sprint_ids UUID[])
RETURNS TABLE (
  sprint_id UUID,
  total_hours NUMERIC
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    te.sprint_id,
    COALESCE(SUM(te.hours), 0) as total_hours
  FROM time_entries te
  WHERE te.sprint_id = ANY(sprint_ids)
  GROUP BY te.sprint_id;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_sprint_hours(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sprint_hours(UUID[]) TO anon;
