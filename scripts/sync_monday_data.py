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
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv


# Load environment variables
load_dotenv()

# Configuration
MONDAY_API_KEY = os.getenv('MONDAY_API_KEY')
MONDAY_BOARD_IDS = {
    'AU': os.getenv('MONDAY_AU_BOARD_ID'),
    'US': os.getenv('MONDAY_US_BOARD_ID'),
    'UK': os.getenv('MONDAY_UK_BOARD_ID')
}
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
            'sync_start': datetime.now(timezone.utc).isoformat(),
            'sync_end': datetime.now(timezone.utc).isoformat(),
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

def determine_sprint_status(group_title, start_date, end_date):
    """
    Determine sprint status based on dates only.
    Client-level status (paused, cancelled) is handled via client.is_active
    
    Status values:
    - 'active': Currently running sprint (today is between start and end)
    - 'completed': Sprint end date has passed
    - 'upcoming': Sprint hasn't started yet
    """
    from datetime import date
    
    today = date.today()
    
    # Parse dates if they're strings
    if isinstance(start_date, str):
        start_date = date.fromisoformat(start_date)
    if isinstance(end_date, str):
        end_date = date.fromisoformat(end_date)
    
    # Date-based status only
    if end_date < today:
        return 'completed'
    elif start_date > today:
        return 'upcoming'
    else:
        return 'active'

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

def get_column_display_value(column_data):
    """
    Get the display value from a column, handling lookup/mirror columns.
    Lookup columns use 'display_value', regular columns use 'text'.
    """
    if not column_data:
        return None
    
    # For mirror/lookup columns, use display_value
    display_value = column_data.get('display_value')
    if display_value:
        return display_value
    
    # Fall back to text for regular columns
    return column_data.get('text')

def fetch_monday_board_data(board_id):
    """Fetch complete board data from Monday.com including subitems with pagination"""

    headers = {
        'Authorization': f'Bearer {MONDAY_API_KEY}',
        'Content-Type': 'application/json'
    }

    # First, get the board structure with groups
    initial_query = """
    {
      boards(ids: [%s]) {
        name
        groups {
          id
          title
        }
      }
    }
    """ % board_id

    response = requests.post(MONDAY_API_URL, headers=headers, json={'query': initial_query})

    if response.status_code != 200:
        raise Exception(f"Monday.com API error: {response.status_code} - {response.text}")

    data = response.json()

    if 'errors' in data:
        raise Exception(f"Monday.com GraphQL errors: {data['errors']}")

    board = data['data']['boards'][0]

    # Now fetch items for each group with pagination
    for group in board['groups']:
        group['items_page'] = {'items': []}
        cursor = None

        while True:
            # Build query with pagination
            cursor_param = f', cursor: "{cursor}"' if cursor else ''

            items_query = """
            {
              boards(ids: [%s]) {
                groups(ids: ["%s"]) {
                  items_page(limit: 100%s) {
                    cursor
                    items {
                      id
                      name
                      column_values {
                        id
                        type
                        column {
                          title
                        }
                        value
                        text
                        ... on MirrorValue {
                          display_value
                        }
                        ... on BoardRelationValue {
                          display_value
                        }
                      }
                      subitems {
                        id
                        name
                        column_values {
                          id
                          type
                          column {
                            title
                          }
                          value
                          text
                          ... on MirrorValue {
                            display_value
                          }
                          ... on BoardRelationValue {
                            display_value
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            """ % (board_id, group['id'], cursor_param)

            response = requests.post(MONDAY_API_URL, headers=headers, json={'query': items_query})

            if response.status_code != 200:
                print(f"Warning: Failed to fetch items for group {group['title']}: {response.status_code}")
                break

            page_data = response.json()

            if 'errors' in page_data:
                print(f"Warning: GraphQL errors for group {group['title']}: {page_data['errors']}")
                break

            items_page = page_data['data']['boards'][0]['groups'][0]['items_page']
            items = items_page.get('items', [])

            if not items:
                break

            group['items_page']['items'].extend(items)

            # Check if there are more pages
            cursor = items_page.get('cursor')
            if not cursor:
                break

    return board

def sync_clients_and_sprints():
    """Main sync function"""
    print(">> Starting Monday.com sync...")

    total_clients_synced = 0
    total_sprints_synced = 0

    try:
        # Sync each board (AU, US, UK)
        for region, board_id in MONDAY_BOARD_IDS.items():
            if not board_id:
                print(f"!! Skipping {region} board - no board ID configured")
                continue

            print(f"\n== Syncing {region} board (ID: {board_id})...")

            try:
                # Fetch data from Monday.com
                board_data = fetch_monday_board_data(board_id)

                clients_synced = 0
                sprints_synced = 0

                print(f"   Found {len(board_data['groups'])} groups")

                # Process each group
                for group in board_data['groups']:
                    group_title = group['title']
                    items = group['items_page']['items']
                    print(f"\n>> Processing group: {group_title} ({len(items)} items)")

                    # Process each item (client)
                    for item in items:
                        try:
                            # Parse client data (pass group_title and region to determine active status)
                            client_data = parse_client_item(item, group_title, region)

                            # Upsert client
                            client_result = supabase.table('clients').upsert(
                                client_data,
                                on_conflict='monday_item_id'
                            ).execute()

                            client_id = client_result.data[0]['id']
                            clients_synced += 1

                            # Show status indicator
                            status_indicator = "[ACTIVE]" if client_data.get('is_active', True) else "[INACTIVE]"
                            print(f"  {status_indicator} Client: {client_data['name']}")

                            # Process subitems (sprints)
                            if 'subitems' in item and item['subitems']:
                                for subitem in item['subitems']:
                                    try:
                                        sprint_data = parse_sprint_subitem(subitem, client_id, group_title)

                                        if sprint_data:
                                            supabase.table('sprints').upsert(
                                                sprint_data,
                                                on_conflict='monday_subitem_id'
                                            ).execute()

                                            sprints_synced += 1
                                            print(f"    -> Sprint: {sprint_data['name']} (#{sprint_data.get('sprint_number', '?')})")

                                    except Exception as e:
                                        print(f"    !! Error syncing sprint {subitem['name']}: {e}")

                        except Exception as e:
                            print(f"  !! Error syncing client {item['name']}: {e}")

                print(f"\n== {region} board complete: {clients_synced} clients, {sprints_synced} sprints")
                total_clients_synced += clients_synced
                total_sprints_synced += sprints_synced

            except Exception as e:
                print(f"!! Error syncing {region} board: {e}")
                continue

        # Log success
        log_sync('monday', 'success', total_clients_synced + total_sprints_synced)

        print(f"\n>> Sync complete!")
        print(f"   Total clients synced: {total_clients_synced}")
        print(f"   Total sprints synced: {total_sprints_synced}")

        return True

    except Exception as e:
        error_msg = str(e)
        print(f"\n!! Sync failed: {error_msg}")
        log_sync('monday', 'error', 0, error_msg)
        return False

def parse_client_item(item, group_title=None, region=None):
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

    # Determine active status based on group title
    # Consider clients active if they're in groups that don't indicate completion/cancellation
    is_active = True
    if group_title:
        inactive_keywords = ['finished', 'refunded', 'cancelled', 'canceled', 'completed', 'archived', 'inactive', 'paused']
        group_lower = group_title.lower()
        is_active = not any(keyword in group_lower for keyword in inactive_keywords)

    client_data = {
        'monday_item_id': int(item['id']),
        'name': item['name'],
        'region': region,  # Store region (AU, US, UK)
        'dpr_lead_id': dpr_lead_id,
        'dpr_support_ids': dpr_support_ids if dpr_support_ids else None,
        'seo_lead_name': columns.get('SEO Lead', {}).get('text'),
        'niche': columns.get('Niches', {}).get('text'),
        'agency_value': parse_numeric(get_column_display_value(columns.get('Agency Value', {}))),
        'client_priority': columns.get('Client Priority', {}).get('text'),
        'campaign_type': columns.get('Campaign Type', {}).get('text'),
        'campaign_start_date': parse_date(columns.get('Campaign Start Date', {}).get('value')),
        'contract_length': columns.get('Contract Length', {}).get('text'),
        'monthly_rate': monthly_rate,
        'monthly_hours': monthly_hours,
        'report_status': columns.get('Report Status', {}).get('text'),
        'last_report_date': parse_date(columns.get('Last Report Date', {}).get('value')),
        'last_invoice_date': parse_date(columns.get('Last Invoice Date', {}).get('value')),
        'is_active': is_active,
        'group_name': group_title,  # Store group name for reference
        'updated_at': datetime.now(timezone.utc).isoformat()
    }

    # Remove None values
    return {k: v for k, v in client_data.items() if v is not None}

def parse_sprint_subitem(subitem, client_id, group_title=None):
    """Parse Monday.com subitem into sprint data"""
    columns = {col['column']['title']: col for col in subitem['column_values']}

    # Extract required fields
    start_date = parse_date(columns.get('Start Date', {}).get('value'))
    end_date = parse_date(columns.get('End Date', {}).get('value'))

    if not start_date or not end_date:
        print(f"      !! Skipping sprint {subitem['name']} - missing dates")
        return None

    # Extract sprint number from Sprint label
    sprint_label = columns.get('Sprint', {}).get('text')
    sprint_number = extract_sprint_number(sprint_label)

    # Parse KPIs
    kpi_target = parse_numeric(columns.get('Link KPI Per Quarter', {}).get('text'))
    kpi_achieved = parse_numeric(columns.get('Links Achieved Per Quarter', {}).get('text'))

    # Parse monthly rate (sprint-level)
    monthly_rate = parse_numeric(columns.get('Monthly Rate (AUD)', {}).get('text'))

    # Determine sprint status based on group and dates
    status = determine_sprint_status(group_title, start_date, end_date)

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
        'status': status,
        'updated_at': datetime.now(timezone.utc).isoformat()
    }

    # Remove None values
    return {k: v for k, v in sprint_data.items() if v is not None}

if __name__ == '__main__':
    # Check environment variables
    board_ids_available = [bid for bid in MONDAY_BOARD_IDS.values() if bid]
    if not all([MONDAY_API_KEY, board_ids_available, SUPABASE_URL, SUPABASE_SERVICE_KEY]):
        print("!! Error: Missing required environment variables")
        print("Required: MONDAY_API_KEY, at least one MONDAY_*_BOARD_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
        exit(1)

    # Run sync
    success = sync_clients_and_sprints()
    exit(0 if success else 1)
