"""
Test the sprint assignment logic directly with LVLY's data.
"""

from supabase import create_client
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

def test_sprint_lookup(client_id, entry_date_str):
    """Test what the sprint lookup query returns for a specific date."""
    
    entry_date = datetime.fromisoformat(entry_date_str).date()
    
    print(f"\n=== Testing Sprint Lookup ===")
    print(f"Client ID: {client_id}")
    print(f"Entry Date: {entry_date}\n")
    
    # This is the exact query used in the sync script (line 300-308)
    response = supabase.table('sprints') \
        .select('id, name, start_date, end_date') \
        .eq('client_id', client_id) \
        .lte('start_date', entry_date.isoformat()) \
        .gte('end_date', entry_date.isoformat()) \
        .execute()
    
    print(f"Query Results: {len(response.data or [])} sprints found")
    
    if response.data:
        for sprint in response.data:
            print(f"\n  ✅ Found Sprint:")
            print(f"     Name: {sprint['name']}")
            print(f"     ID: {sprint['id']}")
            print(f"     Start: {sprint['start_date']}")
            print(f"     End: {sprint['end_date']}")
    else:
        print("\n  ❌ NO SPRINT FOUND")
        print("\n  Debugging: Let's check all sprints for this client...")
        
        all_sprints = supabase.table('sprints') \
            .select('*') \
            .eq('client_id', client_id) \
            .execute()
        
        for sprint in all_sprints.data or []:
            sprint_start = datetime.fromisoformat(sprint['start_date']).date()
            sprint_end = datetime.fromisoformat(sprint['end_date']).date()
            
            print(f"\n  Sprint: {sprint['name']}")
            print(f"    Start: {sprint['start_date']} (Date obj: {sprint_start})")
            print(f"    End: {sprint['end_date']} (Date obj: {sprint_end})")
            print(f"    Entry date: {entry_date}")
            print(f"    start_date <= entry_date? {sprint_start <= entry_date}")
            print(f"    end_date >= entry_date? {sprint_end >= entry_date}")
            
            # Test the query components
            print(f"\n    Testing query filters:")
            
            test1 = supabase.table('sprints') \
                .select('id') \
                .eq('client_id', client_id) \
                .lte('start_date', entry_date.isoformat()) \
                .execute()
            print(f"      .lte('start_date', '{entry_date.isoformat()}'): {len(test1.data or [])} results")
            
            test2 = supabase.table('sprints') \
                .select('id') \
                .eq('client_id', client_id) \
                .gte('end_date', entry_date.isoformat()) \
                .execute()
            print(f"      .gte('end_date', '{entry_date.isoformat()}'): {len(test2.data or [])} results")

if __name__ == '__main__':
    # Test with LVLY client and a problematic date
    lvly_client_id = '158eeeca-5157-4359-835f-10c110b33855'
    test_sprint_lookup(lvly_client_id, '2025-12-01')
    
    print("\n✅ Test complete!\n")
