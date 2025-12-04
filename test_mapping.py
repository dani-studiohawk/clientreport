import os
import sys
sys.path.insert(0, 'scripts')
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

# Import the mapping function from sync script
from sync_clockify_data import map_project_to_client, normalize_name

# Test mapping Sovereign Interiors
project_name = "Sovereign Interiors"
client_id = map_project_to_client(project_name)
print(f'Mapping "{project_name}": {client_id}')

# Check what the client looks like in DB
clients = supabase.table('clients').select('id, name').ilike('name', '%sovereign%').execute()
print(f'\nClients matching "sovereign":')
for c in clients.data:
    print(f'  {c["name"]} (ID: {c["id"]})')
    print(f'    normalized: {normalize_name(c["name"])}')

print(f'\nProject normalized: {normalize_name(project_name)}')

# Manual test of the matching logic
project_lower = project_name.lower()
project_normalized = normalize_name(project_name)

all_clients = supabase.table('clients').select('id, name').execute()
for client in all_clients.data:
    client_lower = client['name'].lower()
    client_normalized = normalize_name(client['name'])
    
    # Check partial match
    if project_lower in client_lower or client_lower in project_lower:
        print(f'\nPartial match found: {client["name"]}')
        
    # Check normalized match
    if project_normalized in client_normalized or client_normalized in project_normalized:
        print(f'Normalized match found: {client["name"]}')
