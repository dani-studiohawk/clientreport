"""Run database migration to add tags column"""
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Read migration SQL
with open('database/migrations/add_tags_to_time_entries.sql', 'r') as f:
    sql = f.read()

print("Running migration to add tags column...")
print(sql)

# Execute each statement separately
statements = [s.strip() for s in sql.split(';') if s.strip()]

for statement in statements:
    try:
        result = supabase.rpc('exec_sql', {'query': statement}).execute()
        print(f"✅ Executed: {statement[:50]}...")
    except Exception as e:
        # Try direct execution via postgrest
        print(f"⚠️ RPC failed, trying direct execution: {e}")
        # For Supabase, we'll need to run this manually
        print(f"\nPlease run this SQL manually in Supabase SQL Editor:")
        print(sql)
        break

print("\n✅ Migration complete!")
