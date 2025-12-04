-- ============================================================================
-- DEBUG SCRIPT: Sprint Date Coverage Analysis
-- ============================================================================
-- Run these queries in Supabase SQL Editor to investigate why 105 time
-- entries couldn't find matching sprints.
-- ============================================================================

-- 1. Check specific examples from sync warnings
-- ============================================================================
CALL
 'FrameShop', '2025-10-22'
SELECT
    'FrameShop on 2025-10-22' as example,
    c.name as client_name,
    s.name as sprint_name,
    s.start_date,
    s.end_date,
    CASE
        WHEN s.start_date <= '2025-10-22' AND s.end_date >= '2025-10-22'
        THEN '✅ MATCH'
        ELSE '❌ NO MATCH'
    END as match_status
FROM clients c
LEFT JOIN sprints s ON s.client_id = c.id
WHERE c.name ILIKE '%FrameShop%'
ORDER BY s.start_date;

-- LHD Lawyers on 2025-10-16
SELECT
    'LHD Lawyers on 2025-10-16' as example,
    c.name as client_name,
    s.name as sprint_name,
    s.start_date,
    s.end_date,
    CASE
        WHEN s.start_date <= '2025-10-16' AND s.end_date >= '2025-10-16'
        THEN '✅ MATCH'
        ELSE '❌ NO MATCH'
    END as match_status
FROM clients c
LEFT JOIN sprints s ON s.client_id = c.id
WHERE c.name ILIKE '%LHD Lawyers%'
ORDER BY s.start_date;

-- Pillow Talk on 2025-10-16
SELECT
    'Pillow Talk on 2025-10-16' as example,
    c.name as client_name,
    s.name as sprint_name,
    s.start_date,
    s.end_date,
    CASE
        WHEN s.start_date <= '2025-10-16' AND s.end_date >= '2025-10-16'
        THEN '✅ MATCH'
        ELSE '❌ NO MATCH'
    END as match_status
FROM clients c
LEFT JOIN sprints s ON s.client_id = c.id
WHERE c.name ILIKE '%Pillow Talk%'
ORDER BY s.start_date;

-- Culture Kings on 2025-10-21
SELECT
    'Culture Kings on 2025-10-21' as example,
    c.name as client_name,
    s.name as sprint_name,
    s.start_date,
    s.end_date,
    CASE
        WHEN s.start_date <= '2025-10-21' AND s.end_date >= '2025-10-21'
        THEN '✅ MATCH'
        ELSE '❌ NO MATCH'
    END as match_status
FROM clients c
LEFT JOIN sprints s ON s.client_id = c.id
WHERE c.name ILIKE '%Culture Kings%'
ORDER BY s.start_date;

-- ============================================================================
-- 2. Check all clients and their sprint date ranges
-- ============================================================================
SELECT
    c.name as client_name,
    COUNT(s.id) as sprint_count,
    MIN(s.start_date) as earliest_sprint_start,
    MAX(s.end_date) as latest_sprint_end
FROM clients c
LEFT JOIN sprints s ON s.client_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;

-- ============================================================================
-- 3. Find clients with NO sprints
-- ============================================================================
SELECT
    c.name as client_name,
    c.monday_item_id,
    c.is_active
FROM clients c
LEFT JOIN sprints s ON s.client_id = c.id
WHERE s.id IS NULL
ORDER BY c.name;

-- ============================================================================
-- 4. Check for date gaps in sprint coverage (for active clients)
-- ============================================================================
WITH client_sprints AS (
    SELECT
        c.id as client_id,
        c.name as client_name,
        s.start_date,
        s.end_date,
        LAG(s.end_date) OVER (PARTITION BY c.id ORDER BY s.start_date) as prev_end_date
    FROM clients c
    JOIN sprints s ON s.client_id = c.id
    WHERE c.is_active = true
)
SELECT
    client_name,
    prev_end_date as previous_sprint_ended,
    start_date as current_sprint_starts,
    start_date - prev_end_date as gap_days
FROM client_sprints
WHERE prev_end_date IS NOT NULL
  AND start_date > prev_end_date + INTERVAL '1 day'
ORDER BY gap_days DESC;

-- ============================================================================
-- 5. Check time entries with NULL sprint_id that have a project assigned
-- ============================================================================
SELECT
    te.project_name,
    te.entry_date,
    COUNT(*) as entry_count,
    SUM(te.hours) as total_hours
FROM time_entries te
WHERE te.sprint_id IS NULL
  AND te.project_name IS NOT NULL
  AND te.project_name != 'Non-Client'
GROUP BY te.project_name, te.entry_date
ORDER BY te.entry_date DESC, te.project_name
LIMIT 50;

-- ============================================================================
-- 6. Check if the date comparison logic would work correctly
-- Test the query that find_sprint_for_date() uses
-- ============================================================================
-- Example: Find sprint for FrameShop on 2025-10-22
SELECT
    s.id,
    s.name,
    s.start_date,
    s.end_date,
    '2025-10-22' as entry_date,
    CASE
        WHEN s.start_date <= '2025-10-22' AND s.end_date >= '2025-10-22'
        THEN '✅ SHOULD MATCH'
        ELSE '❌ NO MATCH'
    END as expected_result
FROM sprints s
JOIN clients c ON s.client_id = c.id
WHERE c.name ILIKE '%FrameShop%'
  AND s.start_date <= '2025-10-22'
  AND s.end_date >= '2025-10-22';

-- ============================================================================
-- 7. Summary: Count issues
-- ============================================================================
SELECT
    'Total clients' as metric,
    COUNT(*) as count
FROM clients
UNION ALL
SELECT
    'Clients with no sprints' as metric,
    COUNT(*) as count
FROM clients c
LEFT JOIN sprints s ON s.client_id = c.id
WHERE s.id IS NULL
UNION ALL
SELECT
    'Total sprints' as metric,
    COUNT(*) as count
FROM sprints
UNION ALL
SELECT
    'Time entries with NULL sprint (non-client work)' as metric,
    COUNT(*) as count
FROM time_entries
WHERE sprint_id IS NULL AND (project_name IS NULL OR project_name = 'Non-Client')
UNION ALL
SELECT
    'Time entries with NULL sprint (client work - PROBLEM)' as metric,
    COUNT(*) as count
FROM time_entries
WHERE sprint_id IS NULL AND project_name IS NOT NULL AND project_name != 'Non-Client';
