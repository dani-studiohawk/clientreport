import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

# Check time_entries table - how many exist and sample
entries = supabase.table('time_entries').select('*').limit(5).execute()
print(f'Sample time entries: {len(entries.data)}')
if entries.data:
    print('Columns:', list(entries.data[0].keys()))
    for e in entries.data:
        print(f'  Client: {e.get("client_id")}, Sprint: {e.get("sprint_id")}, Hours: {e.get("hours")}')

# Total count  
all_entries = supabase.table('time_entries').select('id').execute()
print(f'\nTotal time_entries in DB: {len(all_entries.data)}')

# Check unique client_ids in time_entries
client_ids = supabase.table('time_entries').select('client_id').execute()
unique_clients = set(e['client_id'] for e in client_ids.data if e.get('client_id'))
print(f'Unique client_ids with time entries: {len(unique_clients)}')

# Get client names for those IDs
if unique_clients:
    clients = supabase.table('clients').select('id, name').in_('id', list(unique_clients)).execute()
    print('\nClients with time entries:')
    for c in clients.data:
        print(f'  - {c["name"]}')
