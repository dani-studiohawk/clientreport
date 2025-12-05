"""
Debug script to find time entries that fall within sprint dates but aren't assigned to sprints.
This helps identify issues with the sprint assignment logic.
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

def check_sprint_assignment_issues():
    """Find time entries that should be in sprints but aren't assigned."""
    
    print("\n=== Checking Sprint Assignment Issues ===\n")
    
    # Get all clients with sprints
    clients_response = supabase.table('clients').select('id, name').execute()
    
    for client in clients_response.data:
        client_id = client['id']
        client_name = client['name']
        
        # Get sprints for this client
        sprints_response = supabase.table('sprints') \
            .select('id, name, start_date, end_date') \
            .eq('client_id', client_id) \
            .order('start_date') \
            .execute()
        
        if not sprints_response.data:
            continue
        
        # Get time entries with no sprint_id for this client
        unassigned_response = supabase.table('time_entries') \
            .select('id, entry_date, hours, description, task_category, user_id, users!time_entries_user_id_fkey(name)') \
            .eq('client_id', client_id) \
            .is_('sprint_id', 'null') \
            .order('entry_date') \
            .execute()
        
        if not unassigned_response.data:
            continue
        
        # Check each unassigned entry against sprint dates
        misassigned_entries = []
        
        for entry in unassigned_response.data:
            entry_date = datetime.fromisoformat(entry['entry_date']).date()
            
            for sprint in sprints_response.data:
                sprint_start = datetime.fromisoformat(sprint['start_date']).date()
                sprint_end = datetime.fromisoformat(sprint['end_date']).date()
                
                # Check if entry falls within sprint dates
                if sprint_start <= entry_date <= sprint_end:
                    misassigned_entries.append({
                        'entry': entry,
                        'sprint': sprint,
                        'entry_date': entry_date
                    })
                    break
        
        # Report findings for this client
        if misassigned_entries:
            print(f"\n🔴 {client_name} ({len(misassigned_entries)} misassigned entries)")
            print("=" * 80)
            
            for item in misassigned_entries:
                entry = item['entry']
                sprint = item['sprint']
                user_name = entry.get('users', {}).get('name', 'Unknown') if entry.get('users') else 'Unknown'
                
                print(f"\n  Entry Date: {item['entry_date']}")
                print(f"  Should be in: {sprint['name']} ({sprint['start_date']} to {sprint['end_date']})")
                print(f"  User: {user_name}")
                print(f"  Hours: {entry['hours']}")
                print(f"  Category: {entry.get('task_category', 'N/A')}")
                print(f"  Description: {entry.get('description', 'N/A')[:60]}...")
                print(f"  Entry ID: {entry['id']}")

if __name__ == '__main__':
    check_sprint_assignment_issues()
    print("\n✅ Check complete!\n")
