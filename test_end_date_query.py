"""
Check if the sprint lookup is handling end dates correctly.
"""

from supabase import create_client
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

def test_end_date_query():
    """Test sprint lookup for entries on the exact end date."""
    
    print("\n=== Testing End Date Sprint Lookup ===\n")
    
    # Test case: National Accounts entry on 2025-11-18 (sprint ends 2025-11-18)
    client_name = "National Accounts"
    entry_date = "2025-11-18"
    
    # Get client
    client_resp = supabase.table('clients').select('id').ilike('name', f'%{client_name}%').single().execute()
    client_id = client_resp.data['id']
    
    print(f"Client: {client_name}")
    print(f"Entry Date: {entry_date}\n")
    
    # Show all sprints
    sprints = supabase.table('sprints').select('*').eq('client_id', client_id).execute()
    print("All Sprints:")
    for s in sprints.data:
        print(f"  {s['name']}: {s['start_date']} to {s['end_date']}")
    
    # Test the query that the sync uses
    print(f"\nQuery: .lte('start_date', '{entry_date}').gte('end_date', '{entry_date}')")
    
    result = supabase.table('sprints') \
        .select('*') \
        .eq('client_id', client_id) \
        .lte('start_date', entry_date) \
        .gte('end_date', entry_date) \
        .execute()
    
    print(f"Results: {len(result.data or [])} sprints found")
    
    if result.data:
        for s in result.data:
            print(f"  ✅ {s['name']}: {s['start_date']} to {s['end_date']}")
    else:
        print("  ❌ NO MATCH - This is the bug!")
        print("\n  Testing individual filters:")
        
        test1 = supabase.table('sprints').select('name').eq('client_id', client_id).lte('start_date', entry_date).execute()
        print(f"    .lte('start_date', '{entry_date}'): {len(test1.data or [])} results")
        for s in test1.data or []:
            print(f"      - {s['name']}")
        
        test2 = supabase.table('sprints').select('name, end_date').eq('client_id', client_id).gte('end_date', entry_date).execute()
        print(f"    .gte('end_date', '{entry_date}'): {len(test2.data or [])} results")
        for s in test2.data or []:
            print(f"      - {s['name']} (end_date: {s['end_date']})")

if __name__ == '__main__':
    test_end_date_query()
    print("\n✅ Test complete!\n")
