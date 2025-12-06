"""Debug Grace Loves Lace billable rate issue"""
import os
import sys
sys.path.insert(0, 'scripts')
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

# Get Grace Loves Lace client
result = supabase.table('clients').select(
    'id, name, agency_value, monthly_rate, monthly_hours'
).ilike('name', '%grace%lace%').execute()

if not result.data:
    print("Client not found! Searching for similar names...")
    result = supabase.table('clients').select('name').ilike('name', '%grace%').execute()
    for client in result.data:
        print(f"  - {client['name']}")
    exit(1)

client = result.data[0]
print(f"=== {client['name']} ===\n")
print(f"Agency Value: {client.get('agency_value')}")
print(f"Monthly Rate: {client.get('monthly_rate')}")
print(f"Monthly Hours: {client.get('monthly_hours')}")

# Get sprints
sprints_result = supabase.table('sprints').select(
    'id, sprint_number, monthly_rate, start_date, end_date'
).eq('client_id', client['id']).order('sprint_number').execute()

print(f"\nSprints: {len(sprints_result.data)}")
total_contract_value = 0
for sprint in sprints_result.data:
    sprint_revenue = (sprint.get('monthly_rate') or 0) * 3
    total_contract_value += sprint_revenue
    print(f"  Sprint {sprint.get('sprint_number')}: monthly_rate=${sprint.get('monthly_rate')}, revenue=${sprint_revenue:,.0f}")

print(f"\nTotal Contract Value: ${total_contract_value:,.0f}")

# Get time entries
time_result = supabase.table('time_entries').select(
    'hours, sprint_id'
).eq('client_id', client['id']).execute()

total_hours = sum(entry.get('hours', 0) for entry in time_result.data)
hours_with_sprint = sum(entry.get('hours', 0) for entry in time_result.data if entry.get('sprint_id'))
hours_without_sprint = total_hours - hours_with_sprint

print(f"\nTime Entries: {len(time_result.data)}")
print(f"  Total Hours: {total_hours:.2f}")
print(f"  Hours with sprint_id: {hours_with_sprint:.2f}")
print(f"  Hours without sprint_id: {hours_without_sprint:.2f}")

print("\n" + "="*60)
if total_hours > 0 and total_contract_value > 0:
    rate = total_contract_value / total_hours
    print(f"Calculated Avg Billable Rate: ${rate:.2f}/hr")
else:
    print("Cannot calculate rate:")
    print(f"  - Total hours: {total_hours}")
    print(f"  - Total contract value: {total_contract_value}")
    if total_contract_value == 0:
        print("\n  ⚠️ ISSUE: Total contract value is $0")
        print("     This means all sprints have monthly_rate = 0 or NULL")
print("="*60)
