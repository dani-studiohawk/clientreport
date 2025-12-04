"""
Debug script to investigate why time entries aren't finding matching sprints.
Compares Clockify entry dates with sprint date ranges in Supabase.
"""

import os
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_sprint_coverage():
    """Check sprint date coverage for clients"""

    print("🔍 Analyzing sprint date coverage...\n")

    # Get all clients with sprints
    response = supabase.table('clients') \
        .select('id, name, monday_item_id') \
        .execute()

    clients = response.data

    for client in clients:
        client_id = client['id']
        client_name = client['name']

        # Get sprints for this client
        sprints_response = supabase.table('sprints') \
            .select('id, name, sprint_number, start_date, end_date') \
            .eq('client_id', client_id) \
            .order('start_date') \
            .execute()

        sprints = sprints_response.data

        if not sprints:
            print(f"⚠️  {client_name}: NO SPRINTS")
            continue

        # Get time entries for this client
        entries_response = supabase.table('time_entries') \
            .select('entry_date') \
            .eq('sprint_id', None) \
            .is_('sprint_id', 'null') \
            .execute()

        print(f"📋 {client_name}:")
        print(f"   Sprints: {len(sprints)}")

        for sprint in sprints:
            print(f"   - {sprint['name']}: {sprint['start_date']} to {sprint['end_date']}")

        print()

def check_specific_failures():
    """Check specific examples from the warnings"""

    print("\n🔍 Checking specific failure examples...\n")

    examples = [
        ("FrameShop", "2025-10-22"),
        ("LHD Lawyers", "2025-10-16"),
        ("Pillow Talk", "2025-10-16"),
        ("Culture Kings", "2025-10-21"),
        ("Ella Bache", "2025-10-08"),
    ]

    for client_name, entry_date in examples:
        print(f"🔎 Checking: {client_name} on {entry_date}")

        # Find client
        client_response = supabase.table('clients') \
            .select('id, name') \
            .ilike('name', f'%{client_name}%') \
            .execute()

        if not client_response.data:
            print(f"   ❌ Client not found in database\n")
            continue

        client = client_response.data[0]
        client_id = client['id']

        # Find sprints
        sprints_response = supabase.table('sprints') \
            .select('id, name, start_date, end_date') \
            .eq('client_id', client_id) \
            .execute()

        sprints = sprints_response.data

        if not sprints:
            print(f"   ❌ No sprints found for this client\n")
            continue

        print(f"   ✓ Found client: {client['name']}")
        print(f"   ✓ Has {len(sprints)} sprint(s):")

        match_found = False
        for sprint in sprints:
            start = sprint['start_date']
            end = sprint['end_date']

            # Check if entry_date falls within sprint range
            if start <= entry_date <= end:
                print(f"      ✅ MATCH: {sprint['name']} ({start} to {end})")
                match_found = True
            else:
                print(f"      ❌ NO MATCH: {sprint['name']} ({start} to {end})")

        if not match_found:
            print(f"   ⚠️  Entry date {entry_date} doesn't fall within any sprint range!")

        print()

def check_time_entry_dates():
    """Check the actual time entry dates that failed to match"""

    print("\n🔍 Checking time entries with NULL sprint_id (client work only)...\n")

    # This is tricky - we need to find time entries that should have a sprint
    # but don't. Since we're now tracking non-client work with sprint_id=NULL,
    # we need to check which ones are actually client projects

    # Get all client IDs
    clients_response = supabase.table('clients').select('id, name').execute()
    client_map = {c['id']: c['name'] for c in clients_response.data}

    # Get projects mapped to clients
    projects_response = supabase.table('clockify_projects') \
        .select('id, name, client_id') \
        .not_.is_('client_id', 'null') \
        .execute()

    client_project_ids = [p['id'] for p in projects_response.data]

    print(f"Found {len(client_project_ids)} projects mapped to clients\n")

    # Now check time entries for those projects with NULL sprint_id
    entries_response = supabase.table('time_entries') \
        .select('entry_date, project_name, project_id') \
        .is_('sprint_id', 'null') \
        .in_('project_id', client_project_ids) \
        .order('entry_date.desc') \
        .limit(20) \
        .execute()

    if not entries_response.data:
        print("✅ No client project entries with NULL sprint_id found!")
        return

    print(f"⚠️  Found {len(entries_response.data)} client entries without sprints:")
    for entry in entries_response.data:
        print(f"   - {entry['project_name']}: {entry['entry_date']}")

if __name__ == '__main__':
    print("=" * 60)
    print("SPRINT DATE COVERAGE ANALYSIS")
    print("=" * 60)

    # check_sprint_coverage()
    check_specific_failures()
    # check_time_entry_dates()
