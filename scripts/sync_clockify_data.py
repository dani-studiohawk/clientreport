"""
Sync time entries from Clockify to Supabase

This script:
1. Fetches all time entries from Clockify
2. Maps Clockify users to internal users by email
3. Maps Clockify projects to clients
4. Assigns time entries to sprints based on entry date
5. Upserts to Supabase time_entries table
6. Logs sync status
"""

import os
import requests
from datetime import datetime, timedelta, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
CLOCKIFY_API_KEY = os.getenv('CLOCKIFY_API_KEY')
CLOCKIFY_WORKSPACE_ID = os.getenv('CLOCKIFY_WORKSPACE_ID')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Clockify API base URL
CLOCKIFY_API_URL = 'https://api.clockify.me/api/v1'

# Pre-sprint lookback configuration
# Time entries within this many days before Sprint 1 start will be assigned to Sprint 1
PRE_SPRINT_LOOKBACK_DAYS = 14

# Cache for client sprint data to avoid repeated queries
_client_sprint_cache = {}

def log_sync(source, status, records_synced=0, error_message=None):
    """Log sync status to sync_logs table"""
    try:
        supabase.table('sync_logs').insert({
            'source': source,
            'sync_start': datetime.now(timezone.utc).isoformat(),
            'sync_end': datetime.now(timezone.utc).isoformat(),
            'status': status,
            'records_synced': records_synced,
            'error_message': error_message
        }).execute()
    except Exception as e:
        print(f"Warning: Failed to log sync status: {e}")

def fetch_clockify_users():
    """Fetch all users from Clockify workspace"""
    headers = {'X-Api-Key': CLOCKIFY_API_KEY}
    url = f'{CLOCKIFY_API_URL}/workspaces/{CLOCKIFY_WORKSPACE_ID}/users'

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        raise Exception(f"Clockify API error fetching users: {response.status_code} - {response.text}")

    return response.json()

def fetch_clockify_projects():
    """Fetch all projects from Clockify workspace with pagination"""
    headers = {'X-Api-Key': CLOCKIFY_API_KEY}
    url = f'{CLOCKIFY_API_URL}/workspaces/{CLOCKIFY_WORKSPACE_ID}/projects'

    all_projects = []
    page = 1
    page_size = 500  # Max page size for projects
    
    while True:
        params = {
            'page': page,
            'page-size': page_size,
            'archived': 'false'  # Only active projects
        }
        response = requests.get(url, headers=headers, params=params)

        if response.status_code != 200:
            raise Exception(f"Clockify API error fetching projects: {response.status_code} - {response.text}")

        projects = response.json()
        if not projects:
            break
            
        all_projects.extend(projects)
        
        if len(projects) < page_size:
            break
            
        page += 1
        
        # Safety limit
        if page > 20:
            print("Warning: Reached page limit for projects")
            break

    return all_projects

def fetch_clockify_time_entries(user_id, start_date=None, end_date=None):
    """Fetch time entries for a specific user"""
    headers = {'X-Api-Key': CLOCKIFY_API_KEY}

    # Default to last 365 days if no date range specified
    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=365)

    # Format dates for Clockify API (ISO 8601)
    start_str = start_date.strftime('%Y-%m-%dT00:00:00Z')
    end_str = end_date.strftime('%Y-%m-%dT23:59:59Z')

    all_entries = []
    page = 1
    page_size = 1000  # Max page size

    while True:
        url = f'{CLOCKIFY_API_URL}/workspaces/{CLOCKIFY_WORKSPACE_ID}/user/{user_id}/time-entries'
        params = {
            'start': start_str,
            'end': end_str,
            'page': page,
            'page-size': page_size,
            'hydrated': 'true'  # Include full task/project details
        }

        response = requests.get(url, headers=headers, params=params)

        if response.status_code != 200:
            print(f"Warning: Error fetching time entries for user {user_id} page {page}: {response.status_code}")
            break

        entries = response.json()

        if not entries:
            break  # No more entries

        all_entries.extend(entries)
        page += 1

        # Safety limit
        if page > 100:
            print(f"Warning: Reached page limit for user {user_id}")
            break

    return all_entries

def map_clockify_user_to_internal(clockify_email):
    """Map Clockify user email to internal user UUID"""
    if not clockify_email:
        return None

    try:
        response = supabase.table('users').select('id').eq('email', clockify_email.lower()).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]['id']
    except Exception as e:
        print(f"Warning: Could not map Clockify user {clockify_email}: {e}")

    return None

def normalize_name(name):
    """Normalize a name by converting to lowercase and removing spaces/punctuation"""
    if not name:
        return ""
    import re
    # Remove spaces, punctuation, and convert to lowercase
    return re.sub(r'[^a-zA-Z0-9]', '', name.lower())

# Manual mapping overrides for projects that don't map cleanly
MANUAL_PROJECT_MAPPINGS = {
    # Clockify project name -> Supabase client name
    "Fat Burners Only": "Fat Burners Only",  # Map to the client name that exists
    "Grace Love Lace": "Grace Loves Lace",
    "IconByDesign": "Icon By Design",
    "LuxoLiving": "Luxo Living",
    "NutritionWarehouse": "Nutrition Warehouse",
    "Moon Pig": "Moonpig",
    "Italian Street Kitchen": "Italian Street Kitchen",
    "Lifespan Fitness": "Lifespan Fitness",
    "OSHC Australia Pty Ltd": "OSHC Australia Pty Ltd",
    "Pack & Send": "Pack & Send",
    "LVLY": ""
    # Add any other manual mappings here
}

def map_project_to_client(project_name):
    """
    Map Clockify project name to client ID
    Uses fuzzy matching to find the best match
    """
    if not project_name:
        return None

    try:
        # Check manual mappings first
        manual_client_name = MANUAL_PROJECT_MAPPINGS.get(project_name)
        if manual_client_name:
            response = supabase.table('clients').select('id').ilike('name', manual_client_name).execute()
            if response.data and len(response.data) > 0:
                return response.data[0]['id']

        # Try exact match first
        response = supabase.table('clients').select('id, name').ilike('name', project_name).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]['id']

        # Try partial match (case insensitive)
        response = supabase.table('clients').select('id, name').execute()
        if response.data:
            project_lower = project_name.lower()
            project_normalized = normalize_name(project_name)
            
            for client in response.data:
                client_lower = client['name'].lower()
                client_normalized = normalize_name(client['name'])
                
                # Check if project name contains client name or vice versa (original logic)
                if project_lower in client_lower or client_lower in project_lower:
                    return client['id']
                
                # Check normalized versions (removes spaces/punctuation)
                if project_normalized in client_normalized or client_normalized in project_normalized:
                    return client['id']

    except Exception as e:
        print(f"Warning: Could not map project '{project_name}': {e}")

    return None

def get_client_sprint_data(client_id):
    """
    Get cached sprint data for a client including first sprint and campaign_start_date.
    Returns: { 'first_sprint': {...}, 'last_sprint': {...}, 'campaign_start_date': date|None, 'all_sprints': [...] }
    """
    if client_id in _client_sprint_cache:
        return _client_sprint_cache[client_id]
    
    try:
        # Fetch client's campaign_start_date
        client_response = supabase.table('clients') \
            .select('campaign_start_date') \
            .eq('id', client_id) \
            .execute()
        
        campaign_start_date = None
        if client_response.data and client_response.data[0].get('campaign_start_date'):
            campaign_start_date = datetime.fromisoformat(client_response.data[0]['campaign_start_date']).date()
        
        # Fetch all sprints for this client, ordered by start_date
        sprints_response = supabase.table('sprints') \
            .select('id, name, start_date, end_date, sprint_number') \
            .eq('client_id', client_id) \
            .order('start_date') \
            .execute()
        
        all_sprints = sprints_response.data or []
        first_sprint = all_sprints[0] if all_sprints else None
        last_sprint = all_sprints[-1] if all_sprints else None
        
        cache_data = {
            'first_sprint': first_sprint,
            'last_sprint': last_sprint,
            'campaign_start_date': campaign_start_date,
            'all_sprints': all_sprints
        }
        
        _client_sprint_cache[client_id] = cache_data
        return cache_data
        
    except Exception as e:
        print(f"Warning: Could not fetch sprint data for client {client_id}: {e}")
        return {'first_sprint': None, 'last_sprint': None, 'campaign_start_date': None, 'all_sprints': []}


def find_sprint_for_date(client_id, entry_date, debug=False):
    """
    Find the sprint that a time entry belongs to based on date.
    
    Returns: (sprint_id, tag) tuple where:
        - sprint_id: UUID of matching sprint or None
        - tag: None if exact match, 'pre_sprint_prep' if within lookback window, 
               'post_sprint_work' if after all sprints
    """
    if not client_id or not entry_date:
        return None, None

    try:
        # Convert entry_date to date object for comparison
        if isinstance(entry_date, datetime):
            entry_date = entry_date.date()
        
        entry_date_obj = entry_date
        entry_date_str = entry_date.isoformat() if hasattr(entry_date, 'isoformat') else str(entry_date)

        # Query sprints for this client where entry_date falls within sprint dates
        response = supabase.table('sprints') \
            .select('id, name, start_date, end_date') \
            .eq('client_id', client_id) \
            .lte('start_date', entry_date_str) \
            .gte('end_date', entry_date_str) \
            .execute()

        # Exact match found
        if response.data and len(response.data) > 0:
            if debug:
                print(f"      ✓ Found sprint: {response.data[0]['name']}")
            return response.data[0]['id'], None
        
        # No exact match - check for pre-sprint or post-sprint work
        client_data = get_client_sprint_data(client_id)
        first_sprint = client_data['first_sprint']
        last_sprint = client_data['last_sprint']
        campaign_start_date = client_data['campaign_start_date']
        
        if not first_sprint:
            # No sprints exist for this client
            if debug:
                print(f"      DEBUG: No sprints found for client {client_id}")
            return None, 'no_sprints'
        
        # Parse sprint dates
        first_sprint_start = datetime.fromisoformat(first_sprint['start_date']).date()
        last_sprint_end = datetime.fromisoformat(last_sprint['end_date']).date()
        
        # Check if entry is BEFORE first sprint (potential pre-sprint prep)
        if entry_date_obj < first_sprint_start:
            # Calculate lookback window
            lookback_start = first_sprint_start - timedelta(days=PRE_SPRINT_LOOKBACK_DAYS)
            
            # If campaign_start_date exists, use whichever is later as the cutoff
            if campaign_start_date:
                lookback_start = max(lookback_start, campaign_start_date)
            
            # Entry falls within the pre-sprint lookback window
            if entry_date_obj >= lookback_start:
                if debug:
                    print(f"      ✓ Pre-sprint prep: {entry_date_obj} assigned to {first_sprint['name']} (within {PRE_SPRINT_LOOKBACK_DAYS}-day lookback)")
                return first_sprint['id'], 'pre_sprint_prep'
            else:
                # Entry is too far before the sprint
                if debug:
                    print(f"      ✗ Entry {entry_date_obj} is before lookback window (starts {lookback_start})")
                return None, 'before_campaign'
        
        # Check if entry is AFTER last sprint (post-sprint work)
        if entry_date_obj > last_sprint_end:
            if debug:
                print(f"      ✗ Entry {entry_date_obj} is after last sprint ends ({last_sprint_end})")
            return None, 'post_sprint_work'
        
        # Entry falls in a gap between sprints
        if debug:
            print(f"      DEBUG: Entry {entry_date_obj} falls in gap between sprints")
            for s in client_data['all_sprints']:
                print(f"        - {s['name']}: {s['start_date']} to {s['end_date']}")
        
        return None, 'gap_between_sprints'

    except Exception as e:
        print(f"Warning: Could not find sprint for client {client_id} on date {entry_date}: {e}")

    return None, None

def parse_duration_to_hours(duration_str):
    """
    Convert Clockify duration (PT format) to decimal hours
    Example: PT2H30M -> 2.5
    """
    if not duration_str:
        return 0.0

    hours = 0.0
    minutes = 0.0

    # Extract hours
    if 'H' in duration_str:
        h_index = duration_str.index('H')
        t_index = duration_str.index('T')
        hours = float(duration_str[t_index + 1:h_index])

    # Extract minutes
    if 'M' in duration_str:
        m_index = duration_str.index('M')
        if 'H' in duration_str:
            h_index = duration_str.index('H')
            minutes = float(duration_str[h_index + 1:m_index])
        else:
            t_index = duration_str.index('T')
            minutes = float(duration_str[t_index + 1:m_index])

    return round(hours + (minutes / 60.0), 2)

def sync_time_entries(days_back=365):
    """Main sync function for time entries"""
    print(f">> Starting Clockify sync (last {days_back} days)...")

    try:
        # Fetch Clockify users
        print(">> Fetching Clockify users...")
        clockify_users = fetch_clockify_users()
        print(f"   Found {len(clockify_users)} users")

        # Fetch Clockify projects
        print(">> Fetching Clockify projects...")
        clockify_projects = fetch_clockify_projects()
        print(f"   Found {len(clockify_projects)} projects")

        # Create project ID to client ID mapping
        project_client_map = {}
        for project in clockify_projects:
            client_id = map_project_to_client(project['name'])
            if client_id:
                project_client_map[project['id']] = client_id
                print(f"   [OK] Mapped project '{project['name']}' to client")
            else:
                print(f"   [X] Could not map project '{project['name']}' to any client")

        # Set date range
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days_back)

        entries_synced = 0
        entries_skipped = 0
        skip_reasons = {
            'no_hours': 0,
            'no_sprint': 0,
            'pre_sprint_prep': 0,
            'non_client_work': 0
        }

        # Fetch and process time entries for each user
        for clockify_user in clockify_users:
            user_email = clockify_user.get('email')
            user_name = clockify_user.get('name', 'Unknown')

            if not user_email:
                continue

            # Map to internal user
            internal_user_id = map_clockify_user_to_internal(user_email)

            if not internal_user_id:
                print(f"\n👤 Skipping user {user_name} ({user_email}) - not found in system")
                continue

            print(f"\n👤 Processing user: {user_name}")

            # Fetch time entries
            time_entries = fetch_clockify_time_entries(
                clockify_user['id'],
                start_date,
                end_date
            )

            print(f"   Found {len(time_entries)} time entries")

            # Track entries for this user
            user_entries_synced = 0
            user_entries_skipped = 0

            # Process each entry
            for entry in time_entries:
                try:
                    # Extract data
                    clockify_id = entry['id']
                    project_id = entry.get('projectId')
                    task = entry.get('task')
                    description = entry.get('description', '')
                    time_interval = entry.get('timeInterval', {})

                    # Parse dates
                    start_time = time_interval.get('start')
                    if not start_time:
                        continue

                    entry_date = datetime.fromisoformat(start_time.replace('Z', '+00:00')).date()

                    # Parse duration
                    duration = time_interval.get('duration')
                    hours = parse_duration_to_hours(duration) if duration else 0.0

                    if hours == 0:
                        entries_skipped += 1
                        user_entries_skipped += 1
                        skip_reasons['no_hours'] += 1
                        continue

                    # Get project name (MOVED UP - needed for debug logging)
                    project_name = None
                    for proj in clockify_projects:
                        if proj['id'] == project_id:
                            project_name = proj['name']
                            break

                    # Map to client
                    client_id = project_client_map.get(project_id)

                    # Handle non-client work (internal projects, training, etc.)
                    sprint_id = None
                    tags = []

                    if client_id:
                        # Find sprint for client work (returns tuple: sprint_id, tag)
                        sprint_id, sprint_tag = find_sprint_for_date(client_id, entry_date, debug=False)

                        if sprint_tag:
                            # Add the tag (pre_sprint_prep, post_sprint_work, etc.)
                            tags.append(sprint_tag)
                            
                            if sprint_id:
                                # Pre-sprint prep - assigned to a sprint with a tag
                                print(f"   >> Pre-sprint prep: {project_name} on {entry_date} assigned to sprint (tagged: {sprint_tag})")
                                skip_reasons['pre_sprint_prep'] += 1
                            else:
                                # No sprint assignment possible
                                print(f"   !! No sprint for {project_name} on {entry_date} - tagged as {sprint_tag}")
                                skip_reasons['no_sprint'] += 1
                    else:
                        # Non-client work - still track it but without sprint
                        skip_reasons['non_client_work'] += 1

                    # Get task name
                    task_category = task.get('name') if task else None

                    # Create time entry data
                    time_entry_data = {
                        'clockify_id': clockify_id,
                        'sprint_id': sprint_id,
                        'client_id': client_id,  # Direct client reference
                        'user_id': internal_user_id,
                        'entry_date': entry_date.isoformat(),
                        'hours': hours,
                        'description': description,
                        'task_category': task_category,
                        'project_name': project_name,
                        'tags': tags,
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }

                    # Upsert to database
                    supabase.table('time_entries').upsert(
                        time_entry_data,
                        on_conflict='clockify_id'
                    ).execute()

                    entries_synced += 1
                    user_entries_synced += 1

                except Exception as e:
                    print(f"   !! Error processing time entry: {e}")
                    entries_skipped += 1
                    user_entries_skipped += 1

            print(f"   >> Synced {user_entries_synced} entries (skipped {user_entries_skipped})")

        # Log success
        log_sync('clockify', 'success', entries_synced)

        print(f"\n>> Sync complete!")
        print(f"   Time entries synced: {entries_synced}")
        print(f"   Entries skipped: {entries_skipped}")
        print(f"\n== Breakdown:")
        print(f"   - No hours (running timers): {skip_reasons['no_hours']}")
        print(f"   - Pre-sprint prep (assigned to Sprint 1): {skip_reasons['pre_sprint_prep']}")
        print(f"   - No sprint found (post-sprint/gaps): {skip_reasons['no_sprint']}")
        print(f"   - Non-client work (tracked): {skip_reasons['non_client_work']}")

        return True

    except Exception as e:
        error_msg = str(e)
        print(f"\n!! Sync failed: {error_msg}")
        log_sync('clockify', 'error', 0, error_msg)
        return False

if __name__ == '__main__':
    # Check environment variables
    if not all([CLOCKIFY_API_KEY, CLOCKIFY_WORKSPACE_ID, SUPABASE_URL, SUPABASE_SERVICE_KEY]):
        print("!! Error: Missing required environment variables")
        print("Required: CLOCKIFY_API_KEY, CLOCKIFY_WORKSPACE_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
        exit(1)

    # Run sync (default: last 365 days)
    success = sync_time_entries(days_back=365)
    exit(0 if success else 1)
