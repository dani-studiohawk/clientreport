"""
Test script to verify the sprint date query logic works correctly
"""

import os
from datetime import date
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Test case: FrameShop on 2025-10-22 (we know this should match based on debug output)
print("Testing sprint query logic...\n")

# First, get FrameShop client_id
print("1. Finding FrameShop client...")
client_response = supabase.table('clients') \
    .select('id, name') \
    .ilike('name', '%FrameShop%') \
    .execute()

if not client_response.data:
    print("   ❌ FrameShop client not found!")
    exit(1)

client = client_response.data[0]
client_id = client['id']
client_name = client['name']
print(f"   ✓ Found client: {client_name} (ID: {client_id})")

# Test the exact query from find_sprint_for_date()
print("\n2. Testing sprint query with entry_date='2025-10-22'...")
entry_date_str = '2025-10-22'

print(f"\nQuery: sprints where client_id='{client_id}' AND start_date <= '{entry_date_str}' AND end_date >= '{entry_date_str}'")

response = supabase.table('sprints') \
    .select('id, name, start_date, end_date') \
    .eq('client_id', client_id) \
    .lte('start_date', entry_date_str) \
    .gte('end_date', entry_date_str) \
    .execute()

print(f"\nResults: {len(response.data)} sprint(s) found")

if response.data:
    for sprint in response.data:
        print(f"   ✅ {sprint['name']}: {sprint['start_date']} to {sprint['end_date']}")
else:
    print("   ❌ No sprints matched!")

    # Let's see ALL sprints for this client
    print("\n3. Checking ALL sprints for this client...")
    all_sprints = supabase.table('sprints') \
        .select('id, name, start_date, end_date') \
        .eq('client_id', client_id) \
        .execute()

    print(f"   Total sprints: {len(all_sprints.data)}")
    for sprint in all_sprints.data:
        start = sprint['start_date']
        end = sprint['end_date']
        matches = start <= entry_date_str <= end
        status = "✅ SHOULD MATCH" if matches else "❌ NO MATCH"
        print(f"   {status}: {sprint['name']} ({start} to {end})")

print("\n" + "="*60)
print("If the query found 0 results but manual comparison shows matches,")
print("there's a bug in the Supabase query syntax!")
print("="*60)
