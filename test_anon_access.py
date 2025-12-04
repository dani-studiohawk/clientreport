from supabase import create_client

url = 'https://ylnrkfpchrzvuhqrnwco.supabase.co'
anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsbnJrZnBjaHJ6dnVocXJud2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2ODYxMDIsImV4cCI6MjA3OTI2MjEwMn0.YaoG6W-LlDaNW_6yhFPW0TigqnusTX1o9y9J74hmqbk'

supabase = create_client(url, anon_key)

print('Testing with ANON key (simulating frontend):')
print('=' * 50)

# Test clients
result = supabase.table('clients').select('id, name', count='exact').limit(3).execute()
print(f'Clients: {result.count} rows')
if result.data:
    for c in result.data:
        print(f'  - {c}')
else:
    print('  NO DATA - RLS blocking access!')

# Test time_entries  
result2 = supabase.table('time_entries').select('id', count='exact').limit(1).execute()
print(f'\nTime entries: {result2.count} rows')
if not result2.data:
    print('  NO DATA - RLS blocking access!')

# Test sprints
result3 = supabase.table('sprints').select('id', count='exact').limit(1).execute()
print(f'Sprints: {result3.count} rows')
if not result3.data:
    print('  NO DATA - RLS blocking access!')
