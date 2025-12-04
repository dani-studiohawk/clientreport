"""Check clients with agency_value populated"""
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))
result = supabase.table('clients').select('name, agency_value').not_.is_('agency_value', 'null').limit(10).execute()

print('Clients with agency_value:')
for c in result.data:
    print(f"  {c['name']}: ${c['agency_value']:,.0f}")
