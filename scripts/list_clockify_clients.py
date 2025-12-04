"""
Fetch and list all clients/projects from Clockify
"""

import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
CLOCKIFY_API_KEY = os.getenv('CLOCKIFY_API_KEY')
CLOCKIFY_WORKSPACE_ID = os.getenv('CLOCKIFY_WORKSPACE_ID')

# Clockify API base URL
CLOCKIFY_API_URL = 'https://api.clockify.me/api/v1'

def fetch_clockify_projects():
    """Fetch all projects from Clockify workspace"""
    headers = {'X-Api-Key': CLOCKIFY_API_KEY}
    url = f'{CLOCKIFY_API_URL}/workspaces/{CLOCKIFY_WORKSPACE_ID}/projects'

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        raise Exception(f"Clockify API error: {response.status_code} - {response.text}")

    return response.json()

def fetch_clockify_clients():
    """Fetch all clients from Clockify workspace"""
    headers = {'X-Api-Key': CLOCKIFY_API_KEY}
    url = f'{CLOCKIFY_API_URL}/workspaces/{CLOCKIFY_WORKSPACE_ID}/clients'

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        print(f"Warning: Clients endpoint not available: {response.status_code}")
        return []

    return response.json()

if __name__ == '__main__':
    # Check environment variables
    if not all([CLOCKIFY_API_KEY, CLOCKIFY_WORKSPACE_ID]):
        print("❌ Error: Missing required environment variables")
        print("Required: CLOCKIFY_API_KEY, CLOCKIFY_WORKSPACE_ID")
        exit(1)

    try:
        print("📥 Fetching data from Clockify...")

        # Try to fetch clients directly
        print("\n🔍 Checking for clients endpoint...")
        clients = fetch_clockify_clients()

        if clients:
            print(f"✅ Found {len(clients)} clients via clients endpoint:")
            for client in clients:
                print(f"  • {client.get('name', 'Unknown')}")
        else:
            print("❌ No clients endpoint available")

        # Fetch projects and extract client info
        print("\n📋 Fetching projects...")
        projects = fetch_clockify_projects()
        print(f"Found {len(projects)} projects")

        # Extract unique clients from projects
        clients_from_projects = {}
        projects_without_clients = []

        for project in projects:
            client_name = project.get('clientName')
            if client_name:
                if client_name not in clients_from_projects:
                    clients_from_projects[client_name] = []
                clients_from_projects[client_name].append(project['name'])
            else:
                projects_without_clients.append(project['name'])

        if clients_from_projects:
            print(f"\n🏢 Clients found in projects ({len(clients_from_projects)} total):")
            for client_name, project_list in sorted(clients_from_projects.items()):
                print(f"  • {client_name} ({len(project_list)} projects)")
                if len(project_list) <= 3:  # Show project names if not too many
                    for project in project_list:
                        print(f"    - {project}")
                else:
                    print(f"    - {', '.join(project_list[:3])}...")

        if projects_without_clients:
            print(f"\n📋 Projects without clients ({len(projects_without_clients)} total):")
            for project in sorted(projects_without_clients):
                print(f"  • {project}")

    except Exception as e:
        print(f"❌ Error: {e}")
        exit(1)