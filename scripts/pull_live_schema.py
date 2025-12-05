"""
Pull the current database schema from Supabase using direct PostgreSQL connection
Uses psycopg2 to connect and export schema
"""

import os
from pathlib import Path
from datetime import datetime

try:
    import psycopg2
except ImportError:
    print("❌ psycopg2 is required. Installing...")
    import subprocess
    subprocess.run(["pip", "install", "psycopg2-binary"], check=True)
    import psycopg2

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_PW = os.getenv('SUPABASE_PW')

# Extract project ref from URL
project_ref = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '')

# Database connection details
DB_HOST = f"db.{project_ref}.supabase.co"
DB_USER = "postgres"
DB_NAME = "postgres"
DB_PASSWORD = SUPABASE_PW

# Output paths
script_dir = Path(__file__).parent
database_dir = script_dir.parent / "database"
output_file = database_dir / "schema_live.sql"
backup_file = database_dir / f"schema_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"

def get_schema_info(conn):
    """Get schema information using SQL queries"""
    cursor = conn.cursor()
    
    schema_parts = []
    
    # Add header
    schema_parts.append(f"""--
-- PostgreSQL database dump from Supabase
-- Project: {project_ref}
-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

""")
    
    # Get all tables in public schema
    cursor.execute("""
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename;
    """)
    tables = cursor.fetchall()
    
    schema_parts.append(f"-- Tables found: {len(tables)}\n")
    
    for (table_name,) in tables:
        schema_parts.append(f"\n-- Table: {table_name}\n")
        
        # Get CREATE TABLE statement
        cursor.execute(f"""
            SELECT 
                'CREATE TABLE public.' || quote_ident(c.table_name) || ' (' ||
                string_agg(
                    quote_ident(c.column_name) || ' ' || c.data_type ||
                    CASE WHEN c.character_maximum_length IS NOT NULL 
                        THEN '(' || c.character_maximum_length || ')' 
                        ELSE '' 
                    END ||
                    CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
                    CASE WHEN c.column_default IS NOT NULL 
                        THEN ' DEFAULT ' || c.column_default 
                        ELSE '' 
                    END,
                    ', '
                ) || ');'
            FROM information_schema.columns c
            WHERE c.table_schema = 'public' 
                AND c.table_name = '{table_name}'
            GROUP BY c.table_name;
        """)
        
        result = cursor.fetchone()
        if result:
            schema_parts.append(result[0] + "\n")
    
    # Get indexes
    schema_parts.append("\n-- Indexes\n")
    cursor.execute("""
        SELECT indexdef || ';'
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY indexname;
    """)
    for (index_def,) in cursor.fetchall():
        schema_parts.append(index_def + "\n")
    
    # Get views
    schema_parts.append("\n-- Views\n")
    cursor.execute("""
        SELECT 'CREATE VIEW ' || table_name || ' AS ' || view_definition || ';'
        FROM information_schema.views
        WHERE table_schema = 'public';
    """)
    for (view_def,) in cursor.fetchall():
        schema_parts.append(view_def + "\n")
    
    # Get functions
    schema_parts.append("\n-- Functions\n")
    cursor.execute("""
        SELECT pg_get_functiondef(p.oid) || ';'
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public';
    """)
    for (func_def,) in cursor.fetchall():
        schema_parts.append(func_def + "\n")
    
    # Get RLS policies
    schema_parts.append("\n-- Row Level Security Policies\n")
    cursor.execute("""
        SELECT 
            'CREATE POLICY ' || quote_ident(polname) || 
            ' ON ' || quote_ident(schemaname) || '.' || quote_ident(tablename) ||
            ' FOR ' || polcmd ||
            ' TO ' || polroles ||
            CASE WHEN polqual IS NOT NULL THEN ' USING (' || polqual || ')' ELSE '' END ||
            CASE WHEN polwith_check IS NOT NULL THEN ' WITH CHECK (' || polwith_check || ')' ELSE '' END ||
            ';'
        FROM (
            SELECT 
                pol.polname,
                'public' as schemaname,
                c.relname as tablename,
                CASE pol.polcmd
                    WHEN 'r' THEN 'SELECT'
                    WHEN 'a' THEN 'INSERT'
                    WHEN 'w' THEN 'UPDATE'
                    WHEN 'd' THEN 'DELETE'
                    WHEN '*' THEN 'ALL'
                END as polcmd,
                pg_get_userbyid(pol.polroles[1]) as polroles,
                pg_get_expr(pol.polqual, pol.polrelid) as polqual,
                pg_get_expr(pol.polwithcheck, pol.polrelid) as polwith_check
            FROM pg_policy pol
            JOIN pg_class c ON pol.polrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public'
        ) subq;
    """)
    for (policy_def,) in cursor.fetchall():
        schema_parts.append(policy_def + "\n")
    
    cursor.close()
    return ''.join(schema_parts)

def pull_schema():
    """Pull schema from Supabase using direct connection"""
    
    # Backup current schema if it exists
    if output_file.exists():
        print(f"📦 Backing up current live schema to: {backup_file.name}")
        import shutil
        shutil.copy(output_file, backup_file)
    
    print(f"🔄 Connecting to Supabase ({project_ref})...")
    
    try:
        # Connect to database
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=5432,
            sslmode='require'
        )
        
        print("✅ Connected! Extracting schema...")
        
        # Get schema
        schema_sql = get_schema_info(conn)
        
        # Write to file
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(schema_sql)
        
        print(f"✅ Schema successfully pulled to: {output_file}")
        print(f"📊 Schema file size: {output_file.stat().st_size} bytes")
        
        # Show summary
        with open(output_file, 'r', encoding='utf-8') as f:
            content = f.read()
            tables = content.count('CREATE TABLE')
            functions = content.count('CREATE POLICY')
            views = content.count('CREATE VIEW')
            policies = content.count('CREATE POLICY')
            indexes = content.count('CREATE INDEX')
            
        print(f"\n📋 Schema Summary:")
        print(f"   - Tables: {tables}")
        print(f"   - Indexes: {indexes}")
        print(f"   - Functions: {functions}")
        print(f"   - Views: {views}")
        print(f"   - RLS Policies: {policies}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nMake sure you have:")
        print("1. Correct database credentials in .env")
        print("2. Network access to Supabase")
        print("3. psycopg2-binary installed: pip install psycopg2-binary")

if __name__ == "__main__":
    pull_schema()
