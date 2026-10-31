import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates and returns a Supabase client configured for client-side (browser) usage.
 * Utilizes the official '@supabase/ssr' package to automatically handle browser
 * cookies and session token synchronization with the Next.js server.
 *
 * Security Note:
 * This client strictly uses the public anonymous key (NEXT_PUBLIC_SUPABASE_ANON_KEY).
 * All database operations performed through this client are subject to
 * PostgreSQL Row Level Security (RLS) policies defined in Supabase.
 */
export function createClient() {
  // Retrieve the public Supabase project URL from environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Retrieve the public anonymous API key from environment variables
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Verify that required environment variables are defined
  if (!supabaseUrl || !supabaseAnonKey) {
    // Provide a descriptive warning for developers during initial local setup
    console.warn(
      "HarvestLink Warning: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. " +
      "Please configure your .env.local file using .env.example as a reference."
    );
  }

  // Instantiate and return the browser-safe Supabase client
  return createBrowserClient(
    supabaseUrl || "https://placeholder-url.supabase.co",
    supabaseAnonKey || "placeholder-anon-key"
  );
}
