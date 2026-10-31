"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sprout, LogOut, User, Building, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UserRole, USER_ROLES } from "@/types/auth";

interface DashboardHeaderProps {
  role: UserRole;
  userEmail?: string;
  userName?: string;
  organisationName?: string;
}

/**
 * Universal Dashboard Header Component
 * Displays role context, user identity, organisation badge, and a functional Sign Out button.
 */
export function DashboardHeader({
  role,
  userEmail,
  userName,
  organisationName,
}: DashboardHeaderProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Retrieve current role display definitions
  const roleInfo = USER_ROLES[role] || USER_ROLES.supplier;

  /**
   * Performs clean user sign-out via Supabase Auth and redirects to the landing page
   */
  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Sign-out error:", error);
      setIsSigningOut(false);
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

        {/* Left: Platform Branding & Current Workspace */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm hover:bg-brand-800 transition-colors">
            <Sprout className="h-5 w-5 text-emerald-100" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900">
                HarvestLink<span className="text-brand-600">.</span>Finance
              </span>
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold border ${roleInfo.badgeColor}`}>
                {roleInfo.title.split("(")[0].trim()}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Supply-Chain Finance Operations Portal
            </p>
          </div>
        </div>

        {/* Right: Authenticated User Info & Sign Out */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2 text-right">
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-slate-800">
                {userName || "Authenticated User"}
              </p>
              <p className="text-[11px] text-slate-500">
                {organisationName || userEmail || "Enterprise Partner"}
              </p>
            </div>
          </div>

          {/* Sign Out Action Button */}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50 transition-all"
            title="Sign out of HarvestLink Finance"
          >
            {isSigningOut ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5 text-slate-500" />
            )}
            <span>Sign Out</span>
          </button>
        </div>

      </div>
    </header>
  );
}
