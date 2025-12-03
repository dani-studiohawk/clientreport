import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Load environment variables
api_key = os.getenv('MONDAY_API_KEY')
board_id = os.getenv('MONDAY_AU_BOARD_ID')

if not api_key or not board_id:
    print("API key or board ID not found in environment variables.")
    exit(1)

# Monday.com API endpoint
url = 'https://api.monday.com/v2'

# GraphQL query to get board structure
query = """
{
  boards(ids: [%s]) {
    name
    description
    groups {
      id
      title
      items_page(limit: 5) {
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
        }
      }
    }
    columns {
      id
      title
      type
      settings_str
    }
  }
}
""" % board_id

# Headers
headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json'
}

# Payload
payload = {
    'query': query
}

# Make the request
response = requests.post(url, headers=headers, json=payload)

if response.status_code == 200:
    data = response.json()
    print("Data fetched successfully. Saving to file...")
    with open('monday_board_structure.json', 'w') as f:
        json.dump(data, f, indent=2)
    print("Saved to monday_board_structure.json")
else:
    print(f"Error: {response.status_code}")
    print(response.text)