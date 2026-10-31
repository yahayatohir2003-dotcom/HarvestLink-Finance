import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Route Handler for Supabase Authentication Callbacks
 *
 * Handles auth confirmation loops (such as email signup confirmations
 * or password reset magic links). Exchanges the authorization code
 * for an active user session cookie and routes the user into the platform.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    // Instantiate server-side Supabase client with cookie persistence
    const supabase = await createClient();

    // Exchange the verification code for a valid Supabase session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Redirect successfully authenticated user to dashboard or next target
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If code exchange fails or is missing, redirect to login with an error query
  return NextResponse.redirect(new URL("/login?error=auth-callback-failed", requestUrl.origin));
}
