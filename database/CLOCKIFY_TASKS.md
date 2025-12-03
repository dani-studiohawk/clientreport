# Clockify Task Categories

These are the actual task names from your Clockify dropdown that users select when logging time.

## All Task Names (60 total)

### Administrative & Planning
- Admin
- Internal Data
- Internal KPIs
- Internal Meetings
- Onboarding
- Onboarding Process
- Reclaim Time
- Slack & Emails (Internal)
- Team Meetings
- Tools Development
- Training
- Weekly Planning

### Client Communication
- Client & Internal Meetings
- Client Edits
- DPR Concepts to Client
- Emails & Communication
- Meetings & Communication
- Sales Client Communication
- Sales Internal & External Meetings
- Written Communication

### Content & Writing
- Blog Posts
- Blog Writing
- blog
- blog automating
- Press Release
- Press Release Creation

### Creative & Ideation
- Brief Nova
- Briefs
- Creative Campaign Concepts Form
- Design Brief
- Ideation
- Master Campaign Doc Actions
- UGC Sourcing

### Data & Research
- Competitor Analysis
- Data Analysis
- Data Brief
- Data Edits
- Data Feasibility Check
- Data edits
- Market Research

### DPR Updates & Reporting
- DPR UPDATE
- DPR Update
- DPR Weekly Update
- DPR update
- Weekly Update
- Reporting
- Progression

### Media & Outreach
- Expert Q&A
- Media List Building
- Media List Reviewing
- Media Monitoring
- News Headlines
- Pitching
- Pitching Set Up
- PR Reviewing

### Sales
- Sales
- Sales Pitch Deck & Prep

### General & Other
- General Task Reviewing
- Hiring
- Other
- Reactive Request

---

## Task Categorization for Reporting

For dashboard reporting, these tasks can be grouped into broader categories:

### 1. Client Communication (Comms)
- Client & Internal Meetings
- Client Edits
- DPR Concepts to Client
- Emails & Communication
- Meetings & Communication
- Sales Client Communication
- Sales Internal & External Meetings
- Written Communication

### 2. Data & Research (Data)
- Competitor Analysis
- Data Analysis
- Data Brief
- Data Edits
- Data Feasibility Check
- Data edits
- Market Research
- Expert Q&A

### 3. Outreach & Pitching (Outreach)
- Media List Building
- Media List Reviewing
- Pitching
- Pitching Set Up
- PR Reviewing

### 4. Content Creation (Content)
- Blog Posts
- Blog Writing
- blog
- blog automating
- Press Release
- Press Release Creation
- UGC Sourcing

### 5. Strategy & Planning (Strategy)
- Brief Nova
- Briefs
- Creative Campaign Concepts Form
- Design Brief
- Ideation
- Master Campaign Doc Actions
- Weekly Planning

### 6. Reporting & Updates (Reporting)
- DPR UPDATE
- DPR Update
- DPR Weekly Update
- DPR update
- Weekly Update
- Reporting
- Progression
- Media Monitoring
- News Headlines

### 7. Administrative (Admin)
- Admin
- General Task Reviewing
- Hiring
- Internal Data
- Internal KPIs
- Internal Meetings
- Onboarding
- Onboarding Process
- Reclaim Time
- Slack & Emails (Internal)
- Team Meetings
- Tools Development
- Training

### 8. Sales (Sales)
- Sales
- Sales Pitch Deck & Prep

### 9. Other
- Other
- Reactive Request

---

## Implementation

### Database Storage
- Store the exact task name in `time_entries.task_category`
- No transformation or categorization needed
- Preserve original task name for accurate reporting

### ETL Sync Process
```python
# When syncing from Clockify
time_entry = {
    'task_category': clockify_entry['task']['name'],  # e.g., "Data Analysis"
    'description': clockify_entry['description'],      # Free-text description
    'hours': convert_duration_to_hours(clockify_entry['timeInterval']),
    # ... other fields
}
```

### Frontend Display
- Group by task_category for breakdowns
- Show original task names in tables
- Use broader categories for high-level charts
- Allow filtering by specific tasks or categories

### Analytics Queries
```sql
-- Time by specific task
SELECT
  task_category,
  SUM(hours) as total_hours,
  COUNT(*) as entry_count
FROM time_entries
WHERE sprint_id = 'xxx'
GROUP BY task_category
ORDER BY total_hours DESC;

-- Time by broader category (using CASE statement)
SELECT
  CASE
    WHEN task_category IN ('Client & Internal Meetings', 'Emails & Communication', ...)
      THEN 'Client Communication'
    WHEN task_category IN ('Data Analysis', 'Market Research', ...)
      THEN 'Data & Research'
    -- ... other categories
    ELSE 'Other'
  END as category,
  SUM(hours) as total_hours
FROM time_entries
WHERE sprint_id = 'xxx'
GROUP BY category
ORDER BY total_hours DESC;
```

---

## Notes

- Task names are case-sensitive (e.g., "DPR Update" vs "DPR update")
- Some duplicates exist with different casing
- Tasks are project-specific in Clockify but appear across multiple projects
- New tasks may be added over time - database schema allows any text value
- Consider normalizing duplicates during ETL (e.g., merge all "DPR Update" variants)

---

## Data Quality Considerations

### Potential Issues:
1. **Case inconsistencies:** "DPR Update" vs "DPR update" vs "DPR UPDATE"
2. **Spelling variations:** "Data edits" vs "Data Edits"
3. **Duplicates:** Multiple blog-related tasks

### Recommendations:
1. **Normalize during ETL:**
   ```python
   task_name = clockify_task['name'].strip()
   # Optionally normalize casing
   task_mapping = {
       'DPR update': 'DPR Update',
       'DPR UPDATE': 'DPR Update',
       'Data edits': 'Data Edits',
       # ...
   }
   task_category = task_mapping.get(task_name, task_name)
   ```

2. **Create a task_categories lookup table (future):**
   ```sql
   CREATE TABLE task_categories (
     id UUID PRIMARY KEY,
     name TEXT UNIQUE,
     normalized_name TEXT,
     category_group TEXT,
     is_active BOOLEAN
   );
   ```

3. **Add data validation:**
   - Warn on unknown task names
   - Flag potential duplicates
   - Track when new tasks appear
