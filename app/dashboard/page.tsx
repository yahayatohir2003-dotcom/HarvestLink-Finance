import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Central Dashboard Dispatcher
 * Server-side component that verifies the user's live profile in PostgreSQL
 * and routes them directly to their dedicated role workspace.
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  // Retrieve current session user securely from cookies
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If unauthenticated, redirect to the login screen
  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  // Query verified user profile directly from the 'profiles' database table
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Determine user role from database, falling back to user_metadata
  const role = profile?.role || (user.user_metadata?.role as string | undefined);

  // Dispatch based on verified PostgreSQL role
  switch (role) {
    case "supplier":
      redirect("/dashboard/supplier");
    case "buyer":
      redirect("/dashboard/buyer");
    case "financier":
    case "reviewer":
      redirect("/dashboard/financier");
    case "admin":
      redirect("/dashboard/admin");
    default:
      // Default to supplier portal if role is not yet populated
      redirect("/dashboard/supplier");
  }
}
