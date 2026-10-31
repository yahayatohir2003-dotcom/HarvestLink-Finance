import React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/dashboard-header";
import { PoEditForm } from "@/components/purchase-orders/po-edit-form";
import { UserRole } from "@/types/auth";

export const dynamic = "force-dynamic";

interface PoEditPageProps {
  params: {
    id: string;
  };
}

export default async function PurchaseOrderEditPage({ params }: PoEditPageProps) {
  const { id: orderId } = params;
  const supabase = await createClient();

  // 1. Verify user authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/dashboard/purchase-orders/${orderId}/edit`);
  }

  // 2. Query user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id, phone")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = (profile?.role || user.user_metadata?.role || "buyer") as UserRole;
  const fullName = profile?.full_name || user.user_metadata?.full_name || "Buyer Representative";
  const userEmail = user.email || "";

  // 3. Query existing purchase order
  const admin = createAdminClient();
  const { data: po, error: poErr } = await admin
    .from("purchase_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (poErr || !po) {
    notFound();
  }

  // 4. Authorization check: Only owning buyer or admin can edit, and only in 'draft' status
  const isOwner = profile?.organization_id === po.buyer_organization_id;
  const isAdmin = userRole === "admin";

  if (!isOwner && !isAdmin) {
    redirect(`/dashboard/purchase-orders/${orderId}`);
  }

  if (po.status !== "draft") {
    // Only draft orders can be modified
    redirect(`/dashboard/purchase-orders/${orderId}`);
  }

  // 5. Query order line items
  const { data: items } = await admin
    .from("order_items")
    .select("*")
    .eq("purchase_order_id", orderId)
    .order("created_at", { ascending: true });

  // 6. Query verified suppliers for dropdown
  const { data: suppliers } = await admin
    .from("organizations")
    .select("id, name, organization_type, address, phone")
    .eq("organization_type", "supplier")
    .order("name", { ascending: true });

  // 7. Query buyer organisation name
  let orgName = user.user_metadata?.organisation_name || "Food Processing Co.";
  if (profile?.organization_id) {
    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .maybeSingle();
    if (org?.name) orgName = org.name;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardHeader
        role={userRole}
        userName={fullName}
        organisationName={orgName}
        userEmail={userEmail}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PoEditForm
          order={{
            id: po.id,
            orderReference: po.order_reference,
            supplierOrganizationId: po.supplier_organization_id,
            expectedDeliveryDate: po.expected_delivery_date,
            description: po.description,
            status: po.status,
            items: items || [],
          }}
          suppliers={suppliers || []}
          buyerOrgName={orgName}
        />
      </main>
    </div>
  );
}
