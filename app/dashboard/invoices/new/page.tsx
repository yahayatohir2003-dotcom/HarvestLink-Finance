import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard-header";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { getEligiblePurchaseOrdersForInvoiceAction } from "@/app/dashboard/invoices/actions";
import { UserRole } from "@/types/auth";

export const dynamic = "force-dynamic";

interface NewInvoicePageProps {
  searchParams: {
    poId?: string;
  };
}

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/invoices/new");
  }

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id, phone")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = (profile?.role || user.user_metadata?.role || "supplier") as UserRole;

  // Authorization Guard: Suppliers and Admins only
  if (userRole !== "supplier" && userRole !== "admin") {
    redirect("/dashboard/invoices");
  }

  const fullName = profile?.full_name || user.user_metadata?.full_name || "Supplier Partner";
  const userEmail = user.email || "";

  // 2. Fetch eligible purchase orders
  const { orders } = await getEligiblePurchaseOrdersForInvoiceAction();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <DashboardHeader
        role={userRole}
        userName={fullName}
        userEmail={userEmail}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Navigation & Header */}
        <div>
          <Link
            href="/dashboard/invoices"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Invoices
          </Link>

          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Issue Commercial Invoice
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Generate an official payment request against a confirmed agricultural trade contract
          </p>
        </div>

        {/* Invoice Creation Form */}
        <InvoiceForm
          eligibleOrders={orders}
          preselectedPoId={searchParams.poId}
        />

      </main>
    </div>
  );
}
