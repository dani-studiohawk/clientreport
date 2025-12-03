import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
anon_key = os.environ.get("SUPABASE_ANON_KEY")  # Using anon key, not service role!
supabase = create_client(url, anon_key)

# Try to query without authentication (should return empty)
response = supabase.table('users').select('*').execute()
print(f"Unauthenticated query returned {len(response.data)} rows (should be 0)")

# Note: To fully test, you'd need to sign in a user first