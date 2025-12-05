import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

# Check clockify_projects for Sovereign
projects = supabase.table('clockify_projects').select('*').ilike('name', '%sovereign%').execute()
print('Clockify projects matching Sovereign:')
for p in projects.data:
    print(f'  {p}')

# Also check if there's a client_id mapping
print('\nClockify projects with client_id set (sample):')
mapped = supabase.table('clockify_projects').select('id, name, clockify_project_id, client_id').not_.is_('client_id', 'null').execute()
for p in mapped.data[:10]:
    print(f'  {p["name"]}: client_id={p["client_id"]}')
print(f'... ({len(mapped.data)} total mapped)')

# Check how many projects exist total
all_projects = supabase.table('clockify_projects').select('id, name, client_id').execute()
print(f'\nTotal clockify_projects: {len(all_projects.data)}')
unmapped = [p for p in all_projects.data if not p.get('client_id')]
print(f'Unmapped projects: {len(unmapped)}')
print('\nUnmapped project names:')
for p in unmapped[:20]:
    print(f'  - {p["name"]}')
