"""
Quick script to check which clients exist in Monday.com vs Supabase
This helps identify why some clients aren't syncing
"""

import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("📊 Checking client data in Supabase...\n")

# Get all clients
response = supabase.table('clients').select('name, region, group_name, is_active, monday_item_id').order('name').execute()

print(f"Found {len(response.data)} clients in database:\n")

# Group by region
by_region = {'AU': [], 'US': [], 'UK': [], None: []}
active_count = 0
inactive_count = 0

for client in response.data:
    region = client.get('region')
    is_active = client.get('is_active', True)

    if is_active:
        active_count += 1
    else:
        inactive_count += 1

    by_region.setdefault(region, []).append(client)

print(f"Active clients: {active_count}")
print(f"Inactive clients: {inactive_count}\n")

for region in sorted(by_region.keys(), key=lambda x: (x is None, x)):
    clients = by_region[region]
    if clients:
        print(f"\n{'='*60}")
        print(f"Region: {region or 'Unknown'} ({len(clients)} clients)")
        print('='*60)
        for client in clients:
            status = "[OK]" if client.get('is_active', True) else "💤"
            group = client.get('group_name', 'Unknown')
            print(f"{status} {client['name']:40s} (Group: {group})")

# Check for specific missing clients
print("\n" + "="*60)
print("Checking specific clients:")
print("="*60)

missing_clients = ['Lifespan Fitness', 'Lifespan Fitness (2)', 'Pack & Send', 'OSHC Australia Pty Ltd']

for name in missing_clients:
    found = any(c['name'] == name for c in response.data)
    status = "[OK] Found" if found else "[X] Missing"
    print(f"{status}: {name}")

    # Also check for partial matches
    partial_matches = [c['name'] for c in response.data if name.lower() in c['name'].lower() or c['name'].lower() in name.lower()]
    if partial_matches and not found:
        print(f"   → Possible matches: {', '.join(partial_matches)}")

print("\n" + "="*60)
print("💡 Tip: If clients are missing, run sync_monday_data.py to pull them from Monday.com")
print("="*60)
