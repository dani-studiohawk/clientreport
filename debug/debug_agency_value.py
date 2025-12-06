"""Debug script to check agency_value and monthly_rate data"""
import os
import sys
sys.path.insert(0, 'scripts')
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

# Get a few clients with their values
result = supabase.table('clients').select(
    'name, agency_value, monthly_rate, monthly_hours'
).limit(10).execute()

print("\n=== CLIENT DATA SAMPLE ===\n")
for client in result.data:
    print(f"Client: {client['name']}")
    print(f"  Agency Value: ${client.get('agency_value', 'N/A')}")
    print(f"  Monthly Rate: ${client.get('monthly_rate', 'N/A')}")
    print(f"  Monthly Hours: {client.get('monthly_hours', 'N/A')}")
    
    if client.get('agency_value') and client.get('monthly_rate'):
        ratio = client['agency_value'] / client['monthly_rate']
        print(f"  Ratio (agency_value / monthly_rate): {ratio:.2f}")
    print()

# Get sprint data for one client
result = supabase.table('clients').select(
    'id, name, agency_value, monthly_rate'
).eq('name', 'Budget Pet Products').execute()

if result.data:
    client = result.data[0]
    print(f"\n=== BUDGET PET PRODUCTS DETAIL ===")
    print(f"Agency Value: ${client.get('agency_value')}")
    print(f"Monthly Rate: ${client.get('monthly_rate')}")
    
    # Get sprints for this client
    sprints_result = supabase.table('sprints').select(
        'sprint_number, monthly_rate, start_date, end_date'
    ).eq('client_id', client['id']).order('sprint_number').execute()
    
    print(f"\nSprints:")
    total_sprint_value = 0
    for sprint in sprints_result.data:
        sprint_value = (sprint.get('monthly_rate') or 0) * 3
        total_sprint_value += sprint_value
        print(f"  Sprint {sprint['sprint_number']}: ${sprint.get('monthly_rate')}/mo × 3 = ${sprint_value}")
    
    print(f"\nTotal Sprint Value (sum of all sprint revenues): ${total_sprint_value}")
    print(f"Agency Value from field: ${client.get('agency_value')}")
    
    # Get time entries
    time_result = supabase.table('time_entries').select(
        'hours'
    ).eq('client_id', client['id']).execute()
    
    total_hours = sum(entry.get('hours', 0) for entry in time_result.data)
    print(f"\nTotal Hours Logged: {total_hours:.2f}")
    
    if total_hours > 0 and client.get('agency_value'):
        current_calc = client['agency_value'] / total_hours
        print(f"\nCurrent Avg Billable Rate Calculation:")
        print(f"  ${client['agency_value']} / {total_hours:.2f} hrs = ${current_calc:.2f}/hr")
        
    if total_hours > 0 and total_sprint_value > 0:
        correct_calc = total_sprint_value / total_hours
        print(f"\nCorrect Avg Billable Rate Calculation:")
        print(f"  ${total_sprint_value} / {total_hours:.2f} hrs = ${correct_calc:.2f}/hr")
