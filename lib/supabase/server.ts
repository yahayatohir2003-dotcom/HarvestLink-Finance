import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates and returns a Supabase client configured for Server Components,
 * Server Actions, and Route Handlers in Next.js App Router.
 *
 * Security Note:
 * This client utilizes the user's session cookies and public anonymous key.
 * Every query executes in the context of the authenticated user and strictly
 * honors Supabase Row Level Security (RLS) policies.
 */
export async function createClient() {
  // Await the Next.js incoming cookie store
  const cookieStore = cookies();

  // Retrieve public Supabase configuration from environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "HarvestLink Warning: Missing Supabase environment variables on server. " +
      "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
    );
  }

  // Create server client with standard SSR cookie management
  return createServerClient(
    supabaseUrl || "https://placeholder-url.supabase.co",
    supabaseAnonKey || "placeholder-anon-key",
    {
      cookies: {
        // Read all cookies from the incoming Next.js cookie jar
        getAll() {
          return cookieStore.getAll();
        },
        // Write updated session cookies
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Suppressed when called from Server Components where cookie writing is forbidden
          }
        },
      },
    }
  );
}
