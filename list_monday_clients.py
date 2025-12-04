"""
Fetch and list all clients from Monday.com board
"""

import os
import requests
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

# Monday.com API endpoint
MONDAY_API_URL = 'https://api.monday.com/v2'

def fetch_monday_clients(board_id):
    """Fetch all client names from Monday.com board"""
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
            }
          }
        }
      }
    }
    """ % board_id

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

if __name__ == '__main__':
    # Check environment variables
    if not MONDAY_API_KEY:
        print("❌ Error: Missing required environment variables")
        print("Required: MONDAY_API_KEY")
        exit(1)

    try:
        print("📥 Fetching clients from Monday.com boards...")

        for region, board_id in MONDAY_BOARD_IDS.items():
            if not board_id:
                print(f"⚠️ Skipping {region} board - no board ID configured")
                continue

            print(f"\n🌍 {region} Board:")
            board_data = fetch_monday_clients(board_id)

            print(f"📋 Board: {board_data['name']}")

            for group in board_data['groups']:
                if group['items_page']['items']:  # Only show groups with items
                    print(f"\n📁 Group: {group['title']}")
                    for item in group['items_page']['items']:
                        print(f"  • {item['name']}")

    except Exception as e:
        print(f"❌ Error: {e}")
        exit(1)