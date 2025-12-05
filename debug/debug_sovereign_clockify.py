import os
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

CLOCKIFY_API_KEY = os.getenv('CLOCKIFY_API_KEY')
CLOCKIFY_WORKSPACE_ID = os.getenv('CLOCKIFY_WORKSPACE_ID')
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

headers = {'X-Api-Key': CLOCKIFY_API_KEY}

# Get Sovereign Interiors project from Clockify
url = f'https://api.clockify.me/api/v1/workspaces/{CLOCKIFY_WORKSPACE_ID}/projects'
response = requests.get(url, headers=headers, params={'page-size': 500})
projects = response.json()

sovereign_project = None
for p in projects:
    if 'sovereign' in p['name'].lower():
        sovereign_project = p
        print(f'Found Sovereign project: {p["name"]}')
        print(f'  Project ID: {p["id"]}')
        print(f'  Archived: {p.get("archived", False)}')
        break

if not sovereign_project:
    print('Sovereign project not found!')
    exit()

# Get users to check time entries
users_url = f'https://api.clockify.me/api/v1/workspaces/{CLOCKIFY_WORKSPACE_ID}/users'
users_response = requests.get(users_url, headers=headers)
users = users_response.json()

print(f'\nChecking {len(users)} users for Sovereign time entries...')

total_hours = 0
total_entries = 0

for user in users:
    # Get time entries for this user
    entries_url = f'https://api.clockify.me/api/v1/workspaces/{CLOCKIFY_WORKSPACE_ID}/user/{user["id"]}/time-entries'
    params = {
        'start': '2025-01-01T00:00:00Z',
        'end': '2025-12-31T23:59:59Z',
        'project': sovereign_project['id'],
        'page-size': 1000
    }
    entries_response = requests.get(entries_url, headers=headers, params=params)
    entries = entries_response.json()
    
    if entries:
        user_hours = 0
        for e in entries:
            if e.get('timeInterval') and e['timeInterval'].get('duration'):
                # Parse ISO duration (PT1H30M format)
                duration = e['timeInterval']['duration']
                hours = 0
                if 'H' in duration:
                    h_part = duration.split('H')[0].replace('PT', '')
                    hours += int(h_part) if h_part else 0
                if 'M' in duration:
                    m_part = duration.split('M')[0].split('H')[-1].replace('PT', '')
                    hours += int(m_part) / 60 if m_part else 0
                if 'S' in duration:
                    s_part = duration.split('S')[0].split('M')[-1].replace('PT', '').replace('H', '')
                    hours += int(s_part) / 3600 if s_part else 0
                user_hours += hours
        
        if user_hours > 0:
            print(f'  {user["name"]}: {user_hours:.1f}h ({len(entries)} entries)')
            total_hours += user_hours
            total_entries += len(entries)

print(f'\nTotal Sovereign Interiors in Clockify: {total_hours:.1f}h ({total_entries} entries)')

# Check what's in the time_entries table for Sovereign
print('\n=== Checking Supabase time_entries for Sovereign ===')
sovereign_client = supabase.table('clients').select('id').ilike('name', '%sovereign%').execute()
if sovereign_client.data:
    client_id = sovereign_client.data[0]['id']
    entries = supabase.table('time_entries').select('*').eq('client_id', client_id).execute()
    print(f'Entries in Supabase for Sovereign: {len(entries.data)}')
    
    # Also check by project_name field
    proj_entries = supabase.table('time_entries').select('id, hours, project_name').ilike('project_name', '%sovereign%').execute()
    print(f'Entries with project_name containing "sovereign": {len(proj_entries.data)}')
    for e in proj_entries.data[:5]:
        print(f'  {e}')
