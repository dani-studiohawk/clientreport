import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

# Test: Fetch admin users
response = supabase.table('users').select('email, name, is_admin').execute()

print("✅ Connected to Supabase!")
print(f"Found {len(response.data)} users:")
for user in response.data:
    print(f"  - {user['name']} ({user['email']}) - Admin: {user['is_admin']}")