import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

// Use Supabase database - clean whitespace from copy/paste
let databaseUrl = process.env.SUPABASE_DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL not configured. Please set your Supabase pooled connection string.");
}

// Clean password of leading/trailing whitespace (common copy/paste issue)
try {
  const url = new URL(databaseUrl);
  const cleanPassword = decodeURIComponent(url.password).trim();
  url.password = encodeURIComponent(cleanPassword);
  databaseUrl = url.toString();
  console.log(`Connecting to Supabase PostgreSQL...`);
  console.log(`  Host: ${url.hostname}`);
  console.log(`  Port: ${url.port}`);
  console.log(`  User: ${decodeURIComponent(url.username)}`);
  console.log(`  Database: ${url.pathname.slice(1)}`);
  console.log(`  Password length: ${cleanPassword.length} chars`);
} catch (e) {
  console.error('Invalid database URL format. Expected: postgresql://user:password@host:port/database');
  console.error('Tip: Special characters in password (!@#$%) must be URL-encoded');
  throw e;
}

// Configure postgres-js with appropriate settings for Supabase
const postgresClient = postgres(databaseUrl, { 
  prepare: false,           // Required for PgBouncer/pooled connections
  ssl: { rejectUnauthorized: false },  // SSL required for Supabase
  max: parseInt(process.env.DATABASE_POOL_MAX || "20", 10), // Pool size — tuned for concurrent voice + chat turns
  idle_timeout: 0,          // Let pooler handle connection reuse
  connect_timeout: 15,      // 15 second timeout for faster feedback
  onnotice: () => {},       // Suppress notices
});

const db = drizzlePostgres(postgresClient, { schema });

// Verify database connection on startup
let dbConnected = false;
let dbConnectionError: string | null = null;

async function verifyConnection() {
  try {
    await postgresClient`SELECT 1`;
    dbConnected = true;
    console.log(`Supabase PostgreSQL: Connected successfully`);
    return true;
  } catch (error: any) {
    dbConnected = false;
    dbConnectionError = error?.message || 'Unknown connection error';
    console.error(`Supabase PostgreSQL: Connection failed`);
    console.error('  Error:', dbConnectionError);
    
    // Check if it's a connection timeout (common with wrong port)
    if (error?.code === 'CONNECT_TIMEOUT') {
      console.error('');
      console.error('  ⚠️  CONNECTION TIMEOUT - This usually means you need the POOLED connection string.');
      console.error('');
      console.error('  How to fix:');
      console.error('    1. Go to Supabase Dashboard → Database → Connect');
      console.error('    2. Select "Connection string" → "URI" format');
      console.error('    3. Enable "Use connection pooling" (important!)');
      console.error('    4. Copy the string - it should use port 6543, like:');
      console.error('       postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres');
      console.error('    5. Update the SUPABASE_DATABASE_URL secret in Replit');
      console.error('');
      console.error('  Note: Direct connections (port 5432) do NOT work from serverless environments.');
    } else {
      console.error('  Possible causes:');
      console.error('    - Connection string may be incorrect');
      console.error('    - Supabase project may be paused (free tier)');
      console.error('    - Network connectivity issues');
    }
    console.error('  Dashboard: https://supabase.com/dashboard');
    return false;
  }
}

// Run connection verification (non-blocking)
verifyConnection().catch(() => {});

// Export connection status for health checks
export function getDatabaseStatus() {
  return { connected: dbConnected, error: dbConnectionError };
}

// Cleanup function for graceful shutdown
export async function closeDatabase() {
  await postgresClient.end();
}

export { db };
