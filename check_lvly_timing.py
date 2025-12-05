"""
Check when the misassigned LVLY entries were created to understand the sync timing.
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

def check_lvly_entries():
    """Check the creation timestamps for LVLY entries."""
    
    print("\n=== LVLY Misassigned Entries - Creation Times ===\n")
    
    # Get the specific entry IDs from our previous check
    entry_ids = [
        'f59abf71-f666-4337-9aec-f37ba86a91d4',
        '6bb13d76-9901-4e55-a7ff-e1d1911c7c58',
        '402699fa-86bd-41da-a54e-042a545a21d8',
        '02cbb1db-5227-4a1c-b0ce-3d80f98d2e7b',
        'b865f353-7fb1-4efe-b5ac-79b07be366bc',
        '6f504dbf-1800-4ce2-80f7-39b51225a793',
        'b60ca8e3-b6d8-4a82-a24a-b5a059bd0be1',
        'b151e6f5-6092-4f65-921e-31ec8fb4c528',
        '481eb470-cf54-4fdb-ad49-278834027f5e',
        'b2f43ee4-1516-45b0-af3f-3885677ba02c'
    ]
    
    response = supabase.table('time_entries') \
        .select('id, entry_date, hours, created_at, updated_at, description, task_category') \
        .in_('id', entry_ids) \
        .order('created_at') \
        .execute()
    
    if not response.data:
        print("No entries found!")
        return
    
    print(f"Found {len(response.data)} entries\n")
    
    for entry in response.data:
        created = datetime.fromisoformat(entry['created_at'].replace('Z', '+00:00'))
        updated = datetime.fromisoformat(entry['updated_at'].replace('Z', '+00:00')) if entry.get('updated_at') else None
        
        print(f"Entry Date: {entry['entry_date']} | Hours: {entry['hours']}")
        print(f"  Created: {created.strftime('%Y-%m-%d %H:%M:%S')}")
        if updated and updated != created:
            print(f"  Updated: {updated.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"  Category: {entry.get('task_category', 'N/A')}")
        print(f"  Description: {entry.get('description', 'N/A')[:60]}...")
        print()
    
    # Check when last Clockify sync ran
    print("\n=== Last Clockify Sync ===\n")
    
    sync_response = supabase.table('sync_logs') \
        .select('*') \
        .eq('source', 'clockify') \
        .order('created_at', desc=True) \
        .limit(1) \
        .execute()
    
    if sync_response.data:
        sync = sync_response.data[0]
        sync_time = datetime.fromisoformat(sync['created_at'].replace('Z', '+00:00'))
        print(f"Last sync: {sync_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Records synced: {sync['records_synced']}")
        print(f"\nConclusion: Entries created AFTER this sync won't be assigned to sprints yet.")
        print("The sync runs daily at 4 PM UTC (2 AM AEST), so recent entries may not be processed.")

if __name__ == '__main__':
    check_lvly_entries()
    print("\n✅ Check complete!\n")
