import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

# Get all clients
clients = supabase.table('clients').select('id, name').execute()
client_map = {c['id']: c['name'] for c in clients.data}

# Paginate through ALL time entries
all_entries = []
page_size = 1000
offset = 0

while True:
    batch = supabase.table('time_entries').select('client_id, hours, sprint_id').range(offset, offset + page_size - 1).execute()
    if not batch.data:
        break
    all_entries.extend(batch.data)
    if len(batch.data) < page_size:
        break
    offset += page_size
    print(f'Fetched {len(all_entries)} entries...')

print(f'\nTotal time_entries in DB: {len(all_entries)}')

# Group hours by client
hours_by_client = {}
for e in all_entries:
    client_id = e.get('client_id')
    if client_id:
        hours_by_client[client_id] = hours_by_client.get(client_id, 0) + (e.get('hours') or 0)

print(f'\nUnique clients with time entries: {len(hours_by_client)}')

# Sort by hours and show all
print('\nAll clients with hours:')
sorted_clients = sorted(hours_by_client.items(), key=lambda x: x[1], reverse=True)
for client_id, hours in sorted_clients:
    client_name = client_map.get(client_id, 'UNKNOWN')
    print(f'  {client_name}: {hours:.1f}h')

# Specifically check Sovereign Interiors
sovereign_id = None
for cid, cname in client_map.items():
    if 'sovereign' in cname.lower():
        sovereign_id = cid
        print(f'\n\nSovereign Interiors ID: {sovereign_id}')
        break

if sovereign_id:
    sovereign_hours = hours_by_client.get(sovereign_id, 0)
    print(f'Sovereign Interiors total hours: {sovereign_hours}')
    
    # Get entries for Sovereign
    sov_entries = supabase.table('time_entries').select('*').eq('client_id', sovereign_id).execute()
    print(f'Sovereign entries count: {len(sov_entries.data)}')
