import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard-header";
import { PoCreateForm } from "@/components/purchase-orders/po-create-form";
import { UserRole } from "@/types/auth";

export const dynamic = "force-dynamic";

/**
 * Issue New Purchase Order Page
 * Guarded exclusively for authenticated Corporate Buyers and Administrators.
 */
export default async function NewPurchaseOrderPage() {
  const supabase = await createClient();

  // 1. Verify user authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/purchase-orders/new");
  }

  // 2. Query profile and verify role
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id, phone")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = (profile?.role || user.user_metadata?.role || "buyer") as UserRole;

  if (userRole !== "buyer" && userRole !== "admin") {
    redirect(`/dashboard/${userRole}`);
  }

  // 3. Query linked buyer organisation
  let orgName = user.user_metadata?.organisation_name || "Food Processing Co.";
  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .maybeSingle();
    if (org?.name) orgName = org.name;
  }

  const fullName = profile?.full_name || user.user_metadata?.full_name || "Buyer Representative";
  const userEmail = user.email || "";

  // 4. Query verified supplier organisations for the dropdown
  const admin = createAdminClient();
  const { data: suppliers } = await admin
    .from("organizations")
    .select("id, name, organization_type, address, phone")
    .eq("organization_type", "supplier")
    .order("name", { ascending: true });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardHeader
        role={userRole}
        userName={fullName}
        organisationName={orgName}
        userEmail={userEmail}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PoCreateForm
          suppliers={suppliers || []}
          buyerOrgName={orgName}
        />
      </main>
    </div>
  );
}
