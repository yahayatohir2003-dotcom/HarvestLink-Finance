import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard-header";
import { PoListView, PurchaseOrderListItem } from "@/components/purchase-orders/po-list-view";
import { UserRole } from "@/types/auth";

export const dynamic = "force-dynamic";

/**
 * Purchase Orders Universal Management Page
 *
 * Displays purchase orders tailored to the authenticated organisation:
 * - Buyers see all purchase orders issued by their organisation.
 * - Suppliers see all purchase orders assigned to their organisation.
 * - Platform Administrators and Financiers see ecosystem-wide trade orders.
 */
export default async function PurchaseOrdersPage() {
  const supabase = await createClient();

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/purchase-orders");
  }

  // 2. Query user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id, phone")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = (profile?.role || user.user_metadata?.role || "buyer") as UserRole;
  const fullName = profile?.full_name || user.user_metadata?.full_name || "Authorized User";
  const userEmail = user.email || "";

  // 3. Query user organisation name
  let orgName = user.user_metadata?.organisation_name || "Agribusiness Partner";
  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .maybeSingle();
    if (org?.name) orgName = org.name;
  }

  // 4. Query purchase orders using administrative client to fetch joined organisation names safely
  const admin = createAdminClient();

  let poQuery = admin
    .from("purchase_orders")
    .select(
      `
      id,
      order_reference,
      order_date,
      expected_delivery_date,
      currency,
      total_amount,
      status,
      created_at,
      buyer_organization_id,
      supplier_organization_id,
      order_items(count)
    `
    )
    .order("created_at", { ascending: false });

  // Apply strict organisation isolation based on role
  if (userRole === "buyer" && profile?.organization_id) {
    poQuery = poQuery.eq("buyer_organization_id", profile.organization_id);
  } else if (userRole === "supplier" && profile?.organization_id) {
    poQuery = poQuery.eq("supplier_organization_id", profile.organization_id);
  }

  const { data: rawOrders } = await poQuery;

  // 5. Gather all organisation IDs to fetch names in a single batch query
  const orgIdsSet = new Set<string>();
  rawOrders?.forEach((po) => {
    if (po.buyer_organization_id) orgIdsSet.add(po.buyer_organization_id);
    if (po.supplier_organization_id) orgIdsSet.add(po.supplier_organization_id);
  });

  const orgIdList = Array.from(orgIdsSet);
  let orgMap: Record<string, string> = {};

  if (orgIdList.length > 0) {
    const { data: orgs } = await admin
      .from("organizations")
      .select("id, name")
      .in("id", orgIdList);

    if (orgs) {
      orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
    }
  }

  // 6. Map into client-friendly structure
  const formattedOrders: PurchaseOrderListItem[] = (rawOrders || []).map((po) => {
    const itemsCount =
      Array.isArray(po.order_items) && po.order_items[0] && typeof po.order_items[0] === "object" && "count" in po.order_items[0]
        ? Number((po.order_items[0] as { count: number }).count)
        : 0;

    return {
      id: po.id,
      orderReference: po.order_reference,
      orderDate: po.order_date,
      expectedDeliveryDate: po.expected_delivery_date,
      currency: po.currency || "NGN",
      totalAmount: Number(po.total_amount) || 0,
      status: po.status,
      buyerOrgName: po.buyer_organization_id ? orgMap[po.buyer_organization_id] || "Buyer" : "Unassigned Buyer",
      supplierOrgName: po.supplier_organization_id
        ? orgMap[po.supplier_organization_id] || "Supplier"
        : "Unassigned Supplier",
      itemsCount: itemsCount,
      createdAt: po.created_at,
    };
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardHeader
        role={userRole}
        userName={fullName}
        organisationName={orgName}
        userEmail={userEmail}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PoListView
          orders={formattedOrders}
          userRole={userRole}
          userOrgName={orgName}
        />
      </main>
    </div>
  );
}
