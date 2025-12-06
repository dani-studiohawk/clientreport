"""Verify the billable rate fix for Budget Pet Products"""
import os
import sys
sys.path.insert(0, 'scripts')
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

# Get Budget Pet Products client
result = supabase.table('clients').select(
    'id, name, agency_value, monthly_rate'
).eq('name', 'Budget Pet Products').execute()

if not result.data:
    print("Client not found!")
    exit(1)

client = result.data[0]
print(f"=== {client['name']} ===\n")

# Get sprints
sprints_result = supabase.table('sprints').select(
    'sprint_number, monthly_rate, start_date, end_date'
).eq('client_id', client['id']).order('sprint_number').execute()

print("Sprints:")
total_contract_value = 0
for sprint in sprints_result.data:
    sprint_revenue = (sprint.get('monthly_rate') or 0) * 3
    total_contract_value += sprint_revenue
    print(f"  Sprint {sprint['sprint_number']}: ${sprint.get('monthly_rate')}/mo × 3 = ${sprint_revenue:,.0f}")

print(f"\nTotal Contract Value (calculated): ${total_contract_value:,.0f}")
print(f"Agency Value (from field): ${client.get('agency_value') or 0:,.0f}")

# Get time entries
time_result = supabase.table('time_entries').select(
    'hours'
).eq('client_id', client['id']).execute()

total_hours = sum(entry.get('hours', 0) for entry in time_result.data)
print(f"\nTotal Hours Logged: {total_hours:.2f}")

print("\n" + "="*60)
print("BEFORE FIX (using agency_value):")
if total_hours > 0 and client.get('agency_value'):
    old_rate = client['agency_value'] / total_hours
    print(f"  ${client['agency_value']:,.0f} / {total_hours:.2f} hrs = ${old_rate:.2f}/hr ❌")
else:
    print("  N/A")

print("\nAFTER FIX (using total contract value):")
if total_hours > 0 and total_contract_value > 0:
    new_rate = total_contract_value / total_hours
    print(f"  ${total_contract_value:,.0f} / {total_hours:.2f} hrs = ${new_rate:.2f}/hr ✅")
else:
    print("  N/A")

print("\nExpected billable rate: ~$190/hr (standard StudioHawk rate)")
print("="*60)
