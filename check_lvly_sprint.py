"""
Check LVLY sprint configuration to understand why entries aren't being assigned.
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

def check_lvly_sprint():
    """Check LVLY's sprint and entry date ranges."""
    
    print("\n=== LVLY Sprint Configuration ===\n")
    
    # Get LVLY client
    client_response = supabase.table('clients') \
        .select('id, name') \
        .ilike('name', '%LVLY%') \
        .execute()
    
    if not client_response.data:
        print("LVLY client not found!")
        return
    
    client = client_response.data[0]
    client_id = client['id']
    
    print(f"Client: {client['name']} (ID: {client_id})\n")
    
    # Get sprints
    sprints_response = supabase.table('sprints') \
        .select('*') \
        .eq('client_id', client_id) \
        .order('start_date') \
        .execute()
    
    print(f"Sprints ({len(sprints_response.data or [])}):")
    for sprint in sprints_response.data or []:
        print(f"  - {sprint['name']}")
        print(f"    Start: {sprint['start_date']}")
        print(f"    End: {sprint['end_date']}")
        print(f"    ID: {sprint['id']}")
        print()
    
    # Get time entries with NO sprint assigned
    unassigned_response = supabase.table('time_entries') \
        .select('id, entry_date, hours, created_at') \
        .eq('client_id', client_id) \
        .is_('sprint_id', 'null') \
        .order('entry_date') \
        .execute()
    
    print(f"\nUnassigned Entries ({len(unassigned_response.data or [])}):")
    for entry in unassigned_response.data or []:
        entry_date = datetime.fromisoformat(entry['entry_date']).date()
        created = datetime.fromisoformat(entry['created_at'].replace('Z', '+00:00'))
        
        # Check if it falls within sprint dates
        for sprint in sprints_response.data or []:
            sprint_start = datetime.fromisoformat(sprint['start_date']).date()
            sprint_end = datetime.fromisoformat(sprint['end_date']).date()
            
            if sprint_start <= entry_date <= sprint_end:
                print(f"  ❌ {entry_date} ({entry['hours']}hrs) - SHOULD BE IN {sprint['name']}")
                print(f"      Created: {created.strftime('%Y-%m-%d %H:%M')}")
                break
        else:
            print(f"  ✓ {entry_date} ({entry['hours']}hrs) - Correctly outside all sprints")

if __name__ == '__main__':
    check_lvly_sprint()
    print("\n✅ Check complete!\n")
