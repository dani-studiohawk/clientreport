import os
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

CLOCKIFY_API_KEY = os.getenv('CLOCKIFY_API_KEY')
CLOCKIFY_WORKSPACE_ID = os.getenv('CLOCKIFY_WORKSPACE_ID')
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

# Fetch all Clockify projects
headers = {'X-Api-Key': CLOCKIFY_API_KEY}
url = f'https://api.clockify.me/api/v1/workspaces/{CLOCKIFY_WORKSPACE_ID}/projects'
params = {'page-size': 500}
response = requests.get(url, headers=headers, params=params)
projects = response.json()

print(f'Total Clockify projects: {len(projects)}')

# Get all client names from Supabase
clients = supabase.table('clients').select('id, name').execute()
client_names = {c['name'].lower(): c['id'] for c in clients.data}

# Check which projects match and which don't
matched = []
unmatched = []

for proj in projects:
    proj_name = proj['name']
    proj_lower = proj_name.lower()
    
    # Try exact match
    if proj_lower in client_names:
        matched.append((proj_name, client_names[proj_lower]))
        continue
    
    # Try partial match
    found = False
    for client_name, client_id in client_names.items():
        if proj_lower in client_name or client_name in proj_lower:
            matched.append((proj_name, client_id))
            found = True
            break
    
    if not found:
        unmatched.append(proj_name)

print(f'\nMatched projects: {len(matched)}')
print(f'Unmatched projects: {len(unmatched)}')

print('\n=== UNMATCHED CLOCKIFY PROJECTS ===')
for p in sorted(unmatched):
    print(f'  - {p}')

# Check if Sovereign is in Clockify
print('\n=== Checking for Sovereign in Clockify ===')
for proj in projects:
    if 'sovereign' in proj['name'].lower():
        print(f'  Found: {proj["name"]} (ID: {proj["id"]})')
