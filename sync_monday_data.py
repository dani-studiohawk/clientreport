"""
Sync clients and sprints from Monday.com to Supabase

This script:
1. Fetches all board items (clients) and their subitems (sprints) from Monday.com
2. Parses and transforms the data
3. Upserts to Supabase clients and sprints tables
4. Logs sync status
"""

import os
import re
import json
import requests
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
MONDAY_API_KEY = os.getenv('MONDAY_API_KEY')
MONDAY_BOARD_ID = os.getenv('MONDAY_AU_BOARD_ID')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Initialize Supabase client (using service role key to bypass RLS)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Monday.com API endpoint
MONDAY_API_URL = 'https://api.monday.com/v2'

def log_sync(source, status, records_synced=0, error_message=None):
    """Log sync status to sync_logs table"""
    try:
        supabase.table('sync_logs').insert({
            'source': source,
            'sync_start': datetime.utcnow().isoformat(),
            'sync_end': datetime.utcnow().isoformat(),
            'status': status,
            'records_synced': records_synced,
            'error_message': error_message
        }).execute()
    except Exception as e:
        print(f"Warning: Failed to log sync status: {e}")

def get_monday_person_id_from_value(value_json):
    """Extract Monday.com person ID from person field JSON"""
    if not value_json:
        return None
    try:
        value = json.loads(value_json)
        persons = value.get('personsAndTeams', [])
        if persons and len(persons) > 0:
            return persons[0].get('id')
    except:
        return None
    return None

def get_monday_person_ids_from_value(value_json):
    """Extract multiple Monday.com person IDs from people field JSON"""
    if not value_json:
        return []
    try:
        value = json.loads(value_json)
        persons = value.get('personsAndTeams', [])
        return [p.get('id') for p in persons if p.get('kind') == 'person']
    except:
        return []

def map_monday_person_to_user(monday_person_id):
    """Map Monday.com person ID to internal user UUID"""
    if not monday_person_id:
        return None

    try:
        response = supabase.table('users').select('id').eq('monday_person_id', monday_person_id).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]['id']
    except Exception as e:
        print(f"Warning: Could not map Monday person {monday_person_id}: {e}")

    return None

def extract_sprint_number(sprint_label):
    """
    Extract sprint number from Monday.com Sprint field
    Examples:
    - "Q1 - Ongoing" -> 1
    - "Q2 - Ongoing" -> 2
    - "Sprint #1" -> 1
    - "Sprint #2" -> 2
    """
    if not sprint_label:
        return None

    # Try to match Q1, Q2, Q3, Q4
    match = re.search(r'Q(\d+)', sprint_label, re.IGNORECASE)
    if match:
        return int(match.group(1))

    # Try to match Sprint #1, Sprint #2, etc.
    match = re.search(r'Sprint\s*#?(\d+)', sprint_label, re.IGNORECASE)
    if match:
        return int(match.group(1))

    # Try to extract any number
    match = re.search(r'(\d+)', sprint_label)
    if match:
        return int(match.group(1))

    return None

def parse_date(date_json):
    """Extract date from Monday.com date field JSON"""
    if not date_json:
        return None
    try:
        value = json.loads(date_json)
        return value.get('date')
    except:
        return None

def parse_numeric(value_json):
    """Extract numeric value from Monday.com field JSON"""
    if not value_json:
        return None
    try:
        # Remove quotes if present
        value = value_json.strip('"\'')
        return float(value) if value else None
    except:
        return None

def fetch_monday_board_data():
    """Fetch complete board data from Monday.com including subitems"""
    query = """
    {
      boards(ids: [%s]) {
        name
        groups {
          id
          title
          items_page {
            items {
              id
              name
              column_values {
                id
                column {
                  title
                }
                value
                text
              }
              subitems {
                id
                name
                column_values {
                  id
                  column {
                    title
                  }
                  value
                  text
                }
              }
            }
          }
        }
      }
    }
    """ % MONDAY_BOARD_ID

    headers = {
        'Authorization': f'Bearer {MONDAY_API_KEY}',
        'Content-Type': 'application/json'
    }

    response = requests.post(MONDAY_API_URL, headers=headers, json={'query': query})

    if response.status_code != 200:
        raise Exception(f"Monday.com API error: {response.status_code} - {response.text}")

    data = response.json()

    if 'errors' in data:
        raise Exception(f"Monday.com GraphQL errors: {data['errors']}")

    return data['data']['boards'][0]

def sync_clients_and_sprints():
    """Main sync function"""
    print("🔄 Starting Monday.com sync...")

    try:
        # Fetch data from Monday.com
        print("📥 Fetching board data from Monday.com...")
        board_data = fetch_monday_board_data()

        clients_synced = 0
        sprints_synced = 0

        # Process each group
        for group in board_data['groups']:
            group_title = group['title']
            print(f"\n📂 Processing group: {group_title}")

            # Process each item (client)
            items = group['items_page']['items']

            for item in items:
                try:
                    # Parse client data
                    client_data = parse_client_item(item)

                    # Upsert client
                    client_result = supabase.table('clients').upsert(
                        client_data,
                        on_conflict='monday_item_id'
                    ).execute()

                    client_id = client_result.data[0]['id']
                    clients_synced += 1
                    print(f"  ✅ Client: {client_data['name']}")

                    # Process subitems (sprints)
                    if 'subitems' in item and item['subitems']:
                        for subitem in item['subitems']:
                            try:
                                sprint_data = parse_sprint_subitem(subitem, client_id)

                                if sprint_data:
                                    supabase.table('sprints').upsert(
                                        sprint_data,
                                        on_conflict='monday_subitem_id'
                                    ).execute()

                                    sprints_synced += 1
                                    print(f"    ↳ Sprint: {sprint_data['name']} (#{sprint_data.get('sprint_number', '?')})")

                            except Exception as e:
                                print(f"    ⚠️ Error syncing sprint {subitem['name']}: {e}")

                except Exception as e:
                    print(f"  ⚠️ Error syncing client {item['name']}: {e}")

        # Log success
        log_sync('monday', 'success', clients_synced + sprints_synced)

        print(f"\n✅ Sync complete!")
        print(f"   Clients synced: {clients_synced}")
        print(f"   Sprints synced: {sprints_synced}")

        return True

    except Exception as e:
        error_msg = str(e)
        print(f"\n❌ Sync failed: {error_msg}")
        log_sync('monday', 'error', 0, error_msg)
        return False

def parse_client_item(item):
    """Parse Monday.com board item into client data"""
    columns = {col['column']['title']: col for col in item['column_values']}

    # Extract DPR Lead
    dpr_lead_monday_id = get_monday_person_id_from_value(columns.get('DPR Lead', {}).get('value'))
    dpr_lead_id = map_monday_person_to_user(dpr_lead_monday_id)

    # Extract DPR Support
    dpr_support_monday_ids = get_monday_person_ids_from_value(columns.get('DPR Support', {}).get('value'))
    dpr_support_ids = [map_monday_person_to_user(pid) for pid in dpr_support_monday_ids]
    dpr_support_ids = [uid for uid in dpr_support_ids if uid]  # Filter out None values

    # Calculate monthly hours from monthly rate
    monthly_rate = parse_numeric(columns.get('Monthly Rate', {}).get('text'))
    monthly_hours = monthly_rate / 190.0 if monthly_rate else None

    client_data = {
        'monday_item_id': int(item['id']),
        'name': item['name'],
        'dpr_lead_id': dpr_lead_id,
        'dpr_support_ids': dpr_support_ids if dpr_support_ids else None,
        'seo_lead_name': columns.get('SEO Lead', {}).get('text'),
        'agency_value': parse_numeric(columns.get('Agency Value', {}).get('text')),
        'client_priority': columns.get('Client Priority', {}).get('text'),
        'campaign_type': columns.get('Campaign Type', {}).get('text'),
        'campaign_start_date': parse_date(columns.get('Campaign Start Date', {}).get('value')),
        'monthly_rate': monthly_rate,
        'monthly_hours': monthly_hours,
        'report_status': columns.get('Report Status', {}).get('text'),
        'last_report_date': parse_date(columns.get('Last Report Date', {}).get('value')),
        'last_invoice_date': parse_date(columns.get('Last Invoice Date', {}).get('value')),
        'is_active': True,  # Assume active if in board
        'updated_at': datetime.utcnow().isoformat()
    }

    # Remove None values
    return {k: v for k, v in client_data.items() if v is not None}

def parse_sprint_subitem(subitem, client_id):
    """Parse Monday.com subitem into sprint data"""
    columns = {col['column']['title']: col for col in subitem['column_values']}

    # Extract required fields
    start_date = parse_date(columns.get('Start Date', {}).get('value'))
    end_date = parse_date(columns.get('End Date', {}).get('value'))

    if not start_date or not end_date:
        print(f"      ⚠️ Skipping sprint {subitem['name']} - missing dates")
        return None

    # Extract sprint number from Sprint label
    sprint_label = columns.get('Sprint', {}).get('text')
    sprint_number = extract_sprint_number(sprint_label)

    # Parse KPIs
    kpi_target = parse_numeric(columns.get('Link KPI Per Quarter', {}).get('text'))
    kpi_achieved = parse_numeric(columns.get('Links Achieved Per Quarter', {}).get('text'))

    # Parse monthly rate (sprint-level)
    monthly_rate = parse_numeric(columns.get('Monthly Rate (AUD)', {}).get('text'))

    sprint_data = {
        'monday_subitem_id': int(subitem['id']),
        'client_id': client_id,
        'name': subitem['name'],
        'sprint_number': sprint_number,
        'sprint_label': sprint_label,
        'start_date': start_date,
        'end_date': end_date,
        'kpi_target': int(kpi_target) if kpi_target else 0,
        'kpi_achieved': int(kpi_achieved) if kpi_achieved else 0,
        'monthly_rate': monthly_rate,
        'updated_at': datetime.utcnow().isoformat()
    }

    # Remove None values
    return {k: v for k, v in sprint_data.items() if v is not None}

if __name__ == '__main__':
    # Check environment variables
    if not all([MONDAY_API_KEY, MONDAY_BOARD_ID, SUPABASE_URL, SUPABASE_SERVICE_KEY]):
        print("❌ Error: Missing required environment variables")
        print("Required: MONDAY_API_KEY, MONDAY_AU_BOARD_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
        exit(1)

    # Run sync
    success = sync_clients_and_sprints()
    exit(0 if success else 1)
