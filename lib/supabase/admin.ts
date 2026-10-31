import { createClient } from "@supabase/supabase-js";

/**
 * Creates and returns an administrative Supabase client using the SERVICE ROLE key.
 *
 * CRITICAL SECURITY INSTRUCTIONS:
 * 1. This client bypasses PostgreSQL Row Level Security (RLS).
 * 2. It MUST ONLY be imported and called inside secure server-side environments
 *    (such as Webhooks, background jobs, or privileged admin-only API routes).
 * 3. NEVER import this file into Client Components, hooks, or files marked with 'use client'.
 * 4. NEVER pass the service role key or this client instance to the browser.
 */
export function createAdminClient() {
  // Runtime guard: Ensure this function is strictly executed on the server
  if (typeof window !== "undefined") {
    throw new Error(
      "SECURITY VIOLATION: createAdminClient cannot be executed in browser environments. " +
      "The Supabase service role key must remain strictly on the server."
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "HarvestLink Configuration Error: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing."
    );
  }

  // Instantiate client with autoRefreshToken disabled (admin tokens do not need client-side refresh)
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
