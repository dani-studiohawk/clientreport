"""Quick script to test Monday.com agency_value column with display_value for lookup columns"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

MONDAY_API_KEY = os.getenv('MONDAY_API_KEY')
MONDAY_AU_BOARD_ID = os.getenv('MONDAY_AU_BOARD_ID')

headers = {
    'Authorization': f'Bearer {MONDAY_API_KEY}',
    'Content-Type': 'application/json',
    'API-Version': '2024-10'
}

# Query for items with display_value for mirror/lookup columns
query = """
{
  boards(ids: [%s]) {
    items_page(limit: 5) {
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
      }
    }
  }
}
""" % MONDAY_AU_BOARD_ID

response = requests.post('https://api.monday.com/v2', headers=headers, json={'query': query})
data = response.json()

if 'errors' in data:
    print("GraphQL Errors:", data['errors'])
else:
    items = data['data']['boards'][0]['items_page']['items']
    for item in items:
        print(f"\n=== {item['name']} ===")
        for col in item['column_values']:
            title = col['column']['title']
            col_type = col.get('type', 'unknown')
            if title in ['Agency Value', 'Monthly Rate', 'DPR Lead']:
                display_val = col.get('display_value', 'N/A')
                print(f"  {title}: type={col_type}, text={col.get('text')}, display_value={display_val}")
