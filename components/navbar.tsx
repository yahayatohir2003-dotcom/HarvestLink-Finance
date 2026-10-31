"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sprout, Menu, X, ArrowRight, ShieldCheck, ChevronRight } from "lucide-react";

/**
 * Navigation Bar Component
 * Provides responsive navigation, brand identity for HarvestLink Finance,
 * and direct call-to-actions for account sign-in and organisation registration.
 */
export function Navbar() {
  // State for toggling mobile menu drawer on smaller screens
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-emerald-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-20">

        {/* Brand Logo and Title */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-md shadow-brand-600/20 group-hover:scale-105 transition-transform">
            <Sprout className="h-6 w-6 text-emerald-100" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-brand-700 transition-colors">
              HarvestLink<span className="text-brand-600">.</span>Finance
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Agri-Supply Chain Finance • Nigeria
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/#features"
            className="text-sm font-medium text-slate-600 hover:text-brand-700 transition-colors"
          >
            Capabilities
          </Link>
          <Link
            href="/#roles"
            className="text-sm font-medium text-slate-600 hover:text-brand-700 transition-colors"
          >
            User Roles
          </Link>
          <Link
            href="/#how-it-works"
            className="text-sm font-medium text-slate-600 hover:text-brand-700 transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="/#security"
            className="text-sm font-medium text-slate-600 hover:text-brand-700 transition-colors"
          >
            Security & Compliance
          </Link>
        </nav>

        {/* Desktop Call To Actions */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-semibold text-slate-700 hover:text-brand-700 px-4 py-2 rounded-lg transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 transition-all hover:shadow"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Mobile Hamburger Menu Button */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-6 space-y-4">
          <div className="flex flex-col space-y-1">
            <Link
              href="/#features"
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] flex items-center px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-800 rounded-lg transition-colors"
            >
              Capabilities
            </Link>
            <Link
              href="/#roles"
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] flex items-center px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-800 rounded-lg transition-colors"
            >
              User Roles
            </Link>
            <Link
              href="/#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] flex items-center px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-800 rounded-lg transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="/#security"
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] flex items-center px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-800 rounded-lg transition-colors"
            >
              Security & Compliance
            </Link>
          </div>
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] w-full flex items-center justify-center text-sm font-semibold text-slate-800 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] w-full flex items-center justify-center text-sm font-semibold text-white bg-brand-700 rounded-xl hover:bg-brand-800 shadow-sm transition-colors"
            >
              Register Organisation
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
