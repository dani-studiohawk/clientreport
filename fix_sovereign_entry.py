"""
Fix the one remaining Sovereign Interiors entry by assigning it to the correct sprint.
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

def fix_sovereign_entry():
    """Assign the Sovereign entry to the correct sprint."""
    
    entry_id = '431429cf-b8e6-47f8-9e0e-a9f8cb7032ac'
    entry_date = '2025-11-27'
    client_id = 'e7ed88cc-9cc6-4e9b-8e05-8f6a8a8dff85'
    
    print("\n=== Fixing Sovereign Interiors Entry ===\n")
    
    # Find the correct sprint
    sprint_response = supabase.table('sprints') \
        .select('id, name, start_date, end_date') \
        .eq('client_id', client_id) \
        .lte('start_date', entry_date) \
        .gte('end_date', entry_date) \
        .execute()
    
    if not sprint_response.data:
        print("❌ No matching sprint found!")
        return
    
    sprint = sprint_response.data[0]
    print(f"Found sprint: {sprint['name']} ({sprint['start_date']} to {sprint['end_date']})")
    print(f"Sprint ID: {sprint['id']}")
    
    # Update the entry
    update_response = supabase.table('time_entries') \
        .update({'sprint_id': sprint['id']}) \
        .eq('id', entry_id) \
        .execute()
    
    if update_response.data:
        print(f"\n✅ Successfully assigned entry to {sprint['name']}")
    else:
        print("\n❌ Failed to update entry")

if __name__ == '__main__':
    fix_sovereign_entry()
    print("\n✅ Fix complete!\n")
