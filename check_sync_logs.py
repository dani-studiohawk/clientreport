"""
Check recent sync logs to see if cron jobs are running and what they're doing.
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

def check_sync_logs():
    """Check recent sync activity."""
    
    print("\n=== Recent Sync Logs (Last 7 Days) ===\n")
    
    # Get sync logs from last 7 days
    seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
    
    response = supabase.table('sync_logs') \
        .select('*') \
        .gte('created_at', seven_days_ago) \
        .order('created_at', desc=True) \
        .execute()
    
    if not response.data:
        print("❌ No sync logs found in the last 7 days!")
        return
    
    print(f"Found {len(response.data)} sync logs\n")
    
    for log in response.data:
        created = datetime.fromisoformat(log['created_at'].replace('Z', '+00:00'))
        status = log['status']
        source = log.get('source', 'unknown')
        
        icon = "✅" if status == 'success' else ("🏃" if status == 'running' else "❌")
        
        print(f"{icon} {created.strftime('%Y-%m-%d %H:%M:%S')} - {source.upper()}")
        print(f"   Status: {status}")
        
        if log.get('sync_start'):
            start = datetime.fromisoformat(log['sync_start'].replace('Z', '+00:00'))
            print(f"   Started: {start.strftime('%Y-%m-%d %H:%M:%S')}")
        
        if log.get('sync_end'):
            end = datetime.fromisoformat(log['sync_end'].replace('Z', '+00:00'))
            print(f"   Ended: {end.strftime('%Y-%m-%d %H:%M:%S')}")
        
        if log.get('records_synced') is not None:
            print(f"   Records synced: {log['records_synced']}")
        
        if log.get('error_message'):
            print(f"   Error: {log['error_message']}")
        
        print()

def check_recent_time_entries():
    """Check when recent time entries were created/updated."""
    
    print("\n=== Recent Time Entry Activity ===\n")
    
    # Get time entries from last 7 days (by created_at or updated_at)
    seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
    
    response = supabase.table('time_entries') \
        .select('id, entry_date, hours, sprint_id, created_at, updated_at, clients(name)') \
        .or_(f'created_at.gte.{seven_days_ago},updated_at.gte.{seven_days_ago}') \
        .order('created_at', desc=True) \
        .limit(20) \
        .execute()
    
    if not response.data:
        print("No recent time entries found")
        return
    
    print(f"Last 20 entries created/updated:\n")
    
    for entry in response.data:
        created = datetime.fromisoformat(entry['created_at'].replace('Z', '+00:00'))
        client_name = entry.get('clients', {}).get('name', 'Unknown') if entry.get('clients') else 'Unknown'
        sprint_status = f"Sprint ID: {entry['sprint_id']}" if entry['sprint_id'] else "⚠️  NO SPRINT"
        
        print(f"Entry Date: {entry['entry_date']} | Created: {created.strftime('%Y-%m-%d %H:%M')}")
        print(f"  Client: {client_name} | {sprint_status} | Hours: {entry['hours']}")
        print()

if __name__ == '__main__':
    check_sync_logs()
    check_recent_time_entries()
    print("✅ Check complete!\n")
