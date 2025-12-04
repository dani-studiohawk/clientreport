import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

# Find Sovereign Interiors client
clients = supabase.table('clients').select('id, name').ilike('name', '%sovereign%').execute()
print('Clients matching Sovereign:')
for c in clients.data:
    print(f'  {c}')

if clients.data:
    client_id = clients.data[0]['id']
    client_name = clients.data[0]['name']
    
    # Get sprints for this client
    sprints = supabase.table('sprints').select('id, name, sprint_number, start_date, end_date, status').eq('client_id', client_id).execute()
    print(f'\nSprints for {client_name}:')
    for s in sprints.data:
        print(f'  Sprint #{s["sprint_number"]}: {s["start_date"]} to {s["end_date"]} ({s["status"]}) - ID: {s["id"]}')
    
    # Get time entries for this client
    entries = supabase.table('time_entries').select('id, hours, entry_date, sprint_id, description').eq('client_id', client_id).order('entry_date', desc=True).limit(20).execute()
    print(f'\nTime entries for client (first 20):')
    for e in entries.data:
        print(f'  {e["entry_date"]}: {e["hours"]:.2f}h - sprint_id: {e["sprint_id"]}')
    
    # Count all time entries
    all_entries = supabase.table('time_entries').select('hours, sprint_id').eq('client_id', client_id).execute()
    total_all = sum(e.get('hours', 0) for e in all_entries.data)
    print(f'\nTotal all entries: {total_all:.2f}h ({len(all_entries.data)} entries)')
    
    # Check entries with sprint_id set
    with_sprint = [e for e in all_entries.data if e.get('sprint_id')]
    without_sprint = [e for e in all_entries.data if not e.get('sprint_id')]
    print(f'Entries WITH sprint_id: {len(with_sprint)} ({sum(e["hours"] for e in with_sprint):.2f}h)')
    print(f'Entries WITHOUT sprint_id: {len(without_sprint)} ({sum(e["hours"] for e in without_sprint):.2f}h)')
