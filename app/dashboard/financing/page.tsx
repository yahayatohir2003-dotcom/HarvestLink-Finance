import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard-header";
import { FinancingListView } from "@/components/financing/financing-list-view";
import { EnrichedFinancingRequest, FinancingRequestRecord } from "@/types/financing";
import { UserRole } from "@/types/auth";

export default async function FinancingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/financing");
  }

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, organization_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = (profile?.role || "supplier") as UserRole;
  const admin = createAdminClient();

  // Fetch organization details for header
  let orgName = "Enterprise Partner";
  if (profile?.organization_id) {
    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .maybeSingle();
    if (org?.name) orgName = org.name;
  }

  // 2. Role-Based Access Guard
  // Financing applications are strictly confidential to Suppliers (applicants),
  // Financing Reviewers (underwriters), and Platform Administrators.
  // Buyers are not permitted to access financing application lists or credit memos.
  if (userRole === "buyer") {
    redirect("/dashboard/buyer");
  }

  let requestsQuery = admin
    .from("financing_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (userRole === "supplier") {
    // Suppliers: strictly isolated to requests submitted by their own user or their supplying organisation
    if (profile?.organization_id) {
      const { data: orgPos } = await admin
        .from("purchase_orders")
        .select("id")
        .eq("supplier_organization_id", profile.organization_id);

      const orgPoIds = (orgPos || []).map((p) => p.id);
      if (orgPoIds.length > 0) {
        requestsQuery = requestsQuery.or(
          `requested_by.eq.${user.id},purchase_order_id.in.(${orgPoIds.join(",")})`
        );
      } else {
        requestsQuery = requestsQuery.eq("requested_by", user.id);
      }
    } else {
      requestsQuery = requestsQuery.eq("requested_by", user.id);
    }
  }
  // For financiers and admins: requestsQuery has no filter (sees institutional review pipeline)

  const { data: rawRequests, error: reqErr } = await requestsQuery;

  if (reqErr) {
    console.error("Error querying financing requests:", reqErr);
  }

  const requestsList: FinancingRequestRecord[] = rawRequests || [];

  // 3. Batch enrich with Purchase Order, Buyer Org, Supplier Org, and Requester profiles
  const poIds = Array.from(new Set(requestsList.map((r) => r.purchase_order_id)));
  let poMap: Record<string, any> = {};

  if (poIds.length > 0) {
    const { data: pos } = await admin
      .from("purchase_orders")
      .select("id, order_reference, total_amount, status, buyer_organization_id, supplier_organization_id")
      .in("id", poIds);

    if (pos) {
      // Fetch organization names
      const orgIds = Array.from(
        new Set(
          pos.flatMap((p) => [p.buyer_organization_id, p.supplier_organization_id]).filter(Boolean)
        )
      );

      let orgNameMap: Record<string, string> = {};
      if (orgIds.length > 0) {
        const { data: orgs } = await admin
          .from("organizations")
          .select("id, name")
          .in("id", orgIds);
        if (orgs) {
          orgNameMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
        }
      }

      pos.forEach((p) => {
        poMap[p.id] = {
          ...p,
          buyerOrganization: {
            id: p.buyer_organization_id,
            name: orgNameMap[p.buyer_organization_id] || "Corporate Buyer",
          },
          supplierOrganization: {
            id: p.supplier_organization_id,
            name: orgNameMap[p.supplier_organization_id] || "Commodity Supplier",
          },
        };
      });
    }
  }

  // Fetch requester names
  const requesterIds = Array.from(new Set(requestsList.map((r) => r.requested_by)));
  let requesterMap: Record<string, any> = {};
  if (requesterIds.length > 0) {
    const { data: reqUsers } = await admin
      .from("profiles")
      .select("id, full_name, role")
      .in("id", requesterIds);
    if (reqUsers) {
      requesterMap = Object.fromEntries(reqUsers.map((u) => [u.id, u]));
    }
  }

  const enrichedRequests: EnrichedFinancingRequest[] = requestsList.map((r) => ({
    ...r,
    purchaseOrder: poMap[r.purchase_order_id],
    requester: requesterMap[r.requested_by] || {
      id: r.requested_by,
      full_name: "Trade Representative",
      role: "supplier",
    },
  }));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardHeader
        role={userRole}
        userName={profile?.full_name || user.email}
        organisationName={orgName}
        userEmail={user.email}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Purchase Order Financing
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              {userRole === "financier" || userRole === "admin"
                ? "Institutional credit underwriting desk, application reviews, and facility pipeline."
                : "Non-dilutive working capital backed by confirmed corporate procurement contracts."}
            </p>
          </div>
        </div>

        {/* Requests List View */}
        <FinancingListView
          requests={enrichedRequests}
          userRole={userRole as "supplier" | "financier" | "buyer" | "admin"}
        />
      </main>
    </div>
  );
}
