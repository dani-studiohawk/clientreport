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

# Fetch projects with tasks
projects_url = f'{base_url}/workspaces/{workspace_id}/projects'
projects_response = requests.get(projects_url, headers=headers)

projects_data = []
all_tasks = []
if projects_response.status_code == 200:
    projects_data = projects_response.json()

    # Fetch tasks for each project
    for project in projects_data:  # Get all projects
        project_id = project['id']
        tasks_url = f'{base_url}/workspaces/{workspace_id}/projects/{project_id}/tasks'
        tasks_response = requests.get(tasks_url, headers=headers)

        if tasks_response.status_code == 200:
            project_tasks = tasks_response.json()
            project['tasks'] = project_tasks
            all_tasks.extend(project_tasks)
        else:
            project['tasks'] = []
else:
    print(f"Error fetching projects: {projects_response.status_code}")
    print(projects_response.text)

# Fetch current user
user_url = f'{base_url}/user'
user_response = requests.get(user_url, headers=headers)

user_id = None
if user_response.status_code == 200:
    user_data = user_response.json()
    user_id = user_data['id']
else:
    print(f"Error fetching user: {user_response.status_code}")
    print(user_response.text)
    exit(1)

# Fetch users
users_url = f'{base_url}/workspaces/{workspace_id}/users'
users_response = requests.get(users_url, headers=headers)

users_data = []
if users_response.status_code == 200:
    users_data = users_response.json()
else:
    print(f"Error fetching users: {users_response.status_code}")
    print(users_response.text)

# Fetch time entries (all from all users, with pagination)
time_entries_data = []
if users_data:
    for user in users_data:  # All users
        user_id = user['id']
        page = 1
        page_size = 5000  # High page size to minimize requests
        while True:
            time_entries_url = f'{base_url}/workspaces/{workspace_id}/user/{user_id}/time-entries?page={page}&page-size={page_size}'
            time_entries_response = requests.get(time_entries_url, headers=headers)
            
            if time_entries_response.status_code == 200:
                user_time_entries = time_entries_response.json()
                if not user_time_entries:
                    break  # No more entries
                time_entries_data.extend(user_time_entries)
                page += 1
            else:
                print(f"Error fetching time entries for user {user_id} page {page}: {time_entries_response.status_code}")
                print(time_entries_response.text)
                break  # Stop on error
else:
    print("No users found, skipping time entries fetch")

# Fetch clients
clients_url = f'{base_url}/workspaces/{workspace_id}/clients'
clients_response = requests.get(clients_url, headers=headers)

clients_data = []
if clients_response.status_code == 200:
    clients_data = clients_response.json()
else:
    print(f"Error fetching clients: {clients_response.status_code}")
    print(clients_response.text)

# Get unique task names across all projects
unique_tasks = list({task['name'] for task in all_tasks if 'name' in task})

# Get unique user names
unique_users = list({user.get('name', user['id']) for user in users_data if user})

# Combine data
data = {
    'workspace': workspace_data,
    'projects': projects_data,
    'all_task_names': sorted(unique_tasks),  # Sorted list of all unique task names
    'all_user_names': sorted(unique_users),  # Sorted list of all unique user names
    'time_entries': time_entries_data,
    'users': users_data,
    'clients': clients_data
}

# Save to file
with open('clockify_data_structure.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Clockify data structure saved to clockify_data_structure.json")