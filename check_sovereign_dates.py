import os
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

CLOCKIFY_API_KEY = os.getenv('CLOCKIFY_API_KEY')
CLOCKIFY_WORKSPACE_ID = os.getenv('CLOCKIFY_WORKSPACE_ID')
headers = {'X-Api-Key': CLOCKIFY_API_KEY}

# Get Sovereign project ID
url = f'https://api.clockify.me/api/v1/workspaces/{CLOCKIFY_WORKSPACE_ID}/projects'
response = requests.get(url, headers=headers, params={'page-size': 500})
projects = response.json()

sovereign_id = None
for p in projects:
    if 'sovereign' in p['name'].lower():
        sovereign_id = p['id']
        print(f'Sovereign project ID: {sovereign_id}')
        break

# Get all users
users_url = f'https://api.clockify.me/api/v1/workspaces/{CLOCKIFY_WORKSPACE_ID}/users'
users = requests.get(users_url, headers=headers).json()

# Get time entries for Sovereign from ALL users to see date range
print('\nSovereign Interiors time entries by date:')
all_entries = []

for user in users:
    entries_url = f'https://api.clockify.me/api/v1/workspaces/{CLOCKIFY_WORKSPACE_ID}/user/{user["id"]}/time-entries'
    params = {
        'start': '2024-01-01T00:00:00Z',  # Go back further
        'end': '2025-12-31T23:59:59Z',
        'page-size': 1000
    }
    entries = requests.get(entries_url, headers=headers, params=params).json()
    
    for e in entries:
        if e.get('projectId') == sovereign_id:
            start = e.get('timeInterval', {}).get('start', '')
            if start:
                entry_date = start[:10]
                all_entries.append({
                    'date': entry_date,
                    'user': user['name'],
                    'duration': e.get('timeInterval', {}).get('duration', 'PT0S')
                })

# Sort by date
all_entries.sort(key=lambda x: x['date'])

# Show date range
if all_entries:
    print(f'\nFirst entry: {all_entries[0]["date"]}')
    print(f'Last entry: {all_entries[-1]["date"]}')
    print(f'Total entries: {len(all_entries)}')
    
    # Group by month
    by_month = {}
    for e in all_entries:
        month = e['date'][:7]
        by_month[month] = by_month.get(month, 0) + 1
    
    print('\nEntries by month:')
    for month, count in sorted(by_month.items()):
        print(f'  {month}: {count} entries')
else:
    print('No entries found!')
