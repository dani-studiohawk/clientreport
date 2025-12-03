import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Load environment variables
api_key = os.getenv('CLOCKIFY_API_KEY')
workspace_id = os.getenv('CLOCKIFY_WORKSPACE_ID')

if not api_key or not workspace_id:
    print("API key or workspace ID not found in environment variables.")
    exit(1)

# Clockify API base URL
base_url = 'https://api.clockify.me/api/v1'

# Headers
headers = {
    'X-Api-Key': api_key,
    'Content-Type': 'application/json'
}

# Fetch workspace details
workspace_url = f'{base_url}/workspaces/{workspace_id}'
workspace_response = requests.get(workspace_url, headers=headers)

if workspace_response.status_code != 200:
    print(f"Error fetching workspace: {workspace_response.status_code}")
    print(workspace_response.text)
    exit(1)

workspace_data = workspace_response.json()

# Fetch projects
projects_url = f'{base_url}/workspaces/{workspace_id}/projects'
projects_response = requests.get(projects_url, headers=headers)

projects_data = []
if projects_response.status_code == 200:
    projects_data = projects_response.json()
else:
    print(f"Error fetching projects: {projects_response.status_code}")
    print(projects_response.text)

# Fetch time entries (limit to 10 for structure)
time_entries_url = f'{base_url}/workspaces/{workspace_id}/time-entries?page-size=10'
time_entries_response = requests.get(time_entries_url, headers=headers)

time_entries_data = []
if time_entries_response.status_code == 200:
    time_entries_data = time_entries_response.json()
else:
    print(f"Error fetching time entries: {time_entries_response.status_code}")
    print(time_entries_response.text)

# Fetch users
users_url = f'{base_url}/workspaces/{workspace_id}/users'
users_response = requests.get(users_url, headers=headers)

users_data = []
if users_response.status_code == 200:
    users_data = users_response.json()
else:
    print(f"Error fetching users: {users_response.status_code}")
    print(users_response.text)

# Fetch clients
clients_url = f'{base_url}/workspaces/{workspace_id}/clients'
clients_response = requests.get(clients_url, headers=headers)

clients_data = []
if clients_response.status_code == 200:
    clients_data = clients_response.json()
else:
    print(f"Error fetching clients: {clients_response.status_code}")
    print(clients_response.text)

# Combine data
data = {
    'workspace': workspace_data,
    'projects': projects_data,
    'time_entries': time_entries_data,
    'users': users_data,
    'clients': clients_data
}

# Save to file
with open('clockify_data_structure.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Clockify data structure saved to clockify_data_structure.json")