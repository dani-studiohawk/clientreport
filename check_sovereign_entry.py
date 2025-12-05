"""
Check what's happening with the Sovereign Interiors entry.
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

def check_sovereign_entry():
    """Check the specific Sovereign entry details."""
    
    entry_id = '431429cf-b8e6-47f8-9e0e-a9f8cb7032ac'
    
    print("\n=== Sovereign Interiors Entry Details ===\n")
    
    response = supabase.table('time_entries') \
        .select('*, clients(name)') \
        .eq('id', entry_id) \
        .single() \
        .execute()
    
    if response.data:
        entry = response.data
        print(f"Entry Date: {entry['entry_date']}")
        print(f"Hours: {entry['hours']}")
        print(f"Sprint ID: {entry.get('sprint_id', 'NULL')}")
        print(f"Client ID: {entry.get('client_id', 'NULL')}")
        print(f"Client Name: {entry.get('clients', {}).get('name', 'NULL')}")
        print(f"Project Name: {entry.get('project_name', 'NULL')}")
        print(f"Clockify ID: {entry.get('clockify_id', 'NULL')}")
        print(f"Created: {entry.get('created_at')}")
        print(f"Updated: {entry.get('updated_at')}")
    
    # Check Sovereign sprints
    print("\n=== Sovereign Interiors Sprints ===\n")
    
    client_response = supabase.table('clients') \
        .select('id, name') \
        .ilike('name', '%Sovereign%') \
        .execute()
    
    if client_response.data:
        for client in client_response.data:
            print(f"Client: {client['name']} (ID: {client['id']})")
            
            sprints = supabase.table('sprints') \
                .select('*') \
                .eq('client_id', client['id']) \
                .order('start_date') \
                .execute()
            
            for sprint in sprints.data or []:
                print(f"  - {sprint['name']}: {sprint['start_date']} to {sprint['end_date']}")

if __name__ == '__main__':
    check_sovereign_entry()
    print("\n✅ Check complete!\n")
