import React from "react";
import Link from "next/link";
import { Sprout, ShieldCheck, FileCheck, Layers } from "lucide-react";

/**
 * Footer Component
 * Renders platform overview, role portals, module directory, and
 * legal/regulatory transparency disclaimers for HarvestLink Finance.
 */
export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">

        {/* Top Grid: Brand & Link Groups */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

          {/* Brand & Mission Statement */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Sprout className="h-6 w-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                HarvestLink<span className="text-brand-400">.</span>Finance
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Transforming agricultural trade finance across Nigeria. Connecting grain aggregators,
              cash crop producers, food processors, and institutional lenders through secure milestone-driven
              purchase order financing.
            </p>
            <div className="flex items-center gap-2 text-xs text-brand-400 font-medium">
              <ShieldCheck className="h-4 w-4" />
              Supabase RLS Protected Infrastructure
            </div>
          </div>

          {/* User Role Portals */}
          <div>
            <h3 className="text-sm font-semibold tracking-wider uppercase text-white mb-4">
              Role Portals
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/login?role=supplier" className="hover:text-white transition-colors">
                  Supplier Portal
                </Link>
              </li>
              <li>
                <Link href="/login?role=buyer" className="hover:text-white transition-colors">
                  Buyer Portal
                </Link>
              </li>
              <li>
                <Link href="/login?role=reviewer" className="hover:text-white transition-colors">
                  Financing Reviewer Desk
                </Link>
              </li>
              <li>
                <Link href="/login?role=admin" className="hover:text-white transition-colors">
                  Platform Administration
                </Link>
              </li>
            </ul>
          </div>

          {/* Core Modules Directory */}
          <div>
            <h3 className="text-sm font-semibold tracking-wider uppercase text-white mb-4">
              Platform Modules
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>Purchase Order Management</li>
              <li>Transaction Document Vault</li>
              <li>Milestone Fulfilment Tracking</li>
              <li>Delivery Confirmation</li>
              <li>Invoice Reconciliation</li>
              <li>Simulated Settlement Registry</li>
            </ul>
          </div>

          {/* Regulatory & Security Transparency Note */}
          <div>
            <h3 className="text-sm font-semibold tracking-wider uppercase text-white mb-4">
              Operating Principles
            </h3>
            <p className="text-xs leading-relaxed text-slate-400">
              HarvestLink Finance provides technology infrastructure for agricultural trade verification.
              Credit and financing underwriting decisions reside exclusively with independent financing partners.
              HarvestLink is strictly non-custodial and does not hold deposits or extend loans from its balance sheet.
              Commodity transaction workflows (such as maize aggregation) are illustrative models for demonstration purposes.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-slate-500">
              Storage Bucket: <span className="font-mono text-slate-300">transaction-documents</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Terms */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} HarvestLink Finance Nigeria. All rights reserved.</p>
          <div className="flex gap-6">
            <span>Enterprise Supply-Chain Protocol</span>
            <span>PostgreSQL & RLS Secured</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
