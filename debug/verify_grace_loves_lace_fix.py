"""Verify Grace Loves Lace now calculates correctly with fallback"""
import os
import sys
sys.path.insert(0, 'scripts')
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

# Get Grace Loves Lace client
result = supabase.table('clients').select(
    'id, name, agency_value, monthly_rate'
).ilike('name', '%grace%lace%').execute()

client = result.data[0]
print(f"=== {client['name']} ===\n")

# Get sprints
sprints_result = supabase.table('sprints').select(
    'sprint_number, monthly_rate'
).eq('client_id', client['id']).order('sprint_number').execute()

print("Sprint monthly_rate values:")
total_contract_value_old = 0
total_contract_value_new = 0

for sprint in sprints_result.data:
    sprint_monthly_rate = sprint.get('monthly_rate')
    fallback_rate = sprint_monthly_rate or client.get('monthly_rate') or 0
    
    old_revenue = (sprint_monthly_rate or 0) * 3
    new_revenue = fallback_rate * 3
    
    total_contract_value_old += old_revenue
    total_contract_value_new += new_revenue
    
    print(f"  Sprint {sprint.get('sprint_number')}: {sprint_monthly_rate} → fallback to ${fallback_rate} = ${new_revenue:,.0f}")

print(f"\nOLD calculation (without fallback): ${total_contract_value_old:,.0f}")
print(f"NEW calculation (with fallback): ${total_contract_value_new:,.0f}")

# Get time entries
time_result = supabase.table('time_entries').select('hours').eq('client_id', client['id']).execute()
total_hours = sum(entry.get('hours', 0) for entry in time_result.data)

print(f"\nTotal Hours: {total_hours:.2f}")

print("\n" + "="*60)
print("BEFORE (no fallback):")
if total_hours > 0 and total_contract_value_old > 0:
    print(f"  ${total_contract_value_old:,.0f} / {total_hours:.2f} hrs = ${total_contract_value_old/total_hours:.2f}/hr")
else:
    print(f"  Cannot calculate (contract value = ${total_contract_value_old}) ❌")

print("\nAFTER (with fallback to client.monthly_rate):")
if total_hours > 0 and total_contract_value_new > 0:
    print(f"  ${total_contract_value_new:,.0f} / {total_hours:.2f} hrs = ${total_contract_value_new/total_hours:.2f}/hr ✅")
else:
    print(f"  Cannot calculate ❌")
print("="*60)
