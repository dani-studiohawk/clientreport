import os
import sys
sys.path.insert(0, 'scripts')
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

from sync_clockify_data import (
    fetch_clockify_users, 
    fetch_clockify_projects, 
    map_project_to_client,
    fetch_clockify_time_entries,
    map_clockify_user_to_internal
)
from datetime import datetime, timedelta, timezone

# Fetch Clockify projects
print(">> Fetching Clockify projects...")
clockify_projects = fetch_clockify_projects()

# Create project ID to client ID mapping
project_client_map = {}
for project in clockify_projects:
    client_id = map_project_to_client(project['name'])
    if client_id:
        project_client_map[project['id']] = client_id
        if 'sovereign' in project['name'].lower():
            print(f"   [OK] Mapped Sovereign: '{project['name']}' -> {client_id}")
    else:
        if 'sovereign' in project['name'].lower():
            print(f"   [X] FAILED to map Sovereign: '{project['name']}'")

print(f"\nTotal projects: {len(clockify_projects)}")
print(f"Mapped projects: {len(project_client_map)}")

# Find Sovereign project ID
sovereign_clockify_id = None
for p in clockify_projects:
    if 'sovereign' in p['name'].lower():
        sovereign_clockify_id = p['id']
        print(f"\nSovereign Clockify ID: {sovereign_clockify_id}")
        print(f"Is in project_client_map: {sovereign_clockify_id in project_client_map}")
        if sovereign_clockify_id in project_client_map:
            print(f"Maps to client_id: {project_client_map[sovereign_clockify_id]}")
        break

# Now check if entries are being fetched
print("\n>> Checking time entries for users...")
clockify_users = fetch_clockify_users()

end_date = datetime.now(timezone.utc)
start_date = end_date - timedelta(days=365)

for user in clockify_users:
    user_email = user.get('email')
    user_name = user.get('name', 'Unknown')
    
    entries = fetch_clockify_time_entries(user['id'], start_date, end_date)
    
    # Count Sovereign entries
    sovereign_entries = [e for e in entries if e.get('projectId') == sovereign_clockify_id]
    if sovereign_entries:
        print(f"   {user_name}: {len(sovereign_entries)} Sovereign entries")
