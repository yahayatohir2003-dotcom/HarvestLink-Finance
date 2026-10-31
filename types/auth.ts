/**
 * HarvestLink Finance - User Roles and Authentication Type Definitions
 *
 * Defines the role types and user authentication contracts according to
 * the project specification and PostgreSQL database constraints:
 * 1. supplier: Agricultural aggregators, cooperative leaders, or produce farmers
 * 2. buyer: Food processors, grain millers, commodity traders, FMCGs
 * 3. financier: Institutional financiers and credit risk officers (Financing Reviewers)
 * 4. admin: System administrators managing platform health and accounts
 */

// Union type representing all recognized user roles matching PostgreSQL 'profiles_role_check'
export type UserRole = "supplier" | "buyer" | "financier" | "admin";

// Human-friendly role metadata for rendering labels and badges across UI components
export interface RoleDefinition {
  id: UserRole;
  title: string;
  description: string;
  badgeColor: string;
}

// Registry mapping role identifiers to human-readable titles, descriptions, and styling
export const USER_ROLES: Record<UserRole, RoleDefinition> = {
  supplier: {
    id: "supplier",
    title: "Supplier (Aggregator / Farmer)",
    description: "Receive purchase orders, request financing, upload shipment milestones, and manage commodity deliveries.",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  buyer: {
    id: "buyer",
    title: "Buyer (Processor / FMCG / Trader)",
    description: "Issue purchase orders, confirm warehouse receipts and commodity deliveries, and reconcile supplier invoices.",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
  },
  financier: {
    id: "financier",
    title: "Financing Reviewer (Financier / Underwriter)",
    description: "Assess purchase order financing requests, inspect verification documents, and approve or reject facility terms.",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
  },
  admin: {
    id: "admin",
    title: "Platform Administrator",
    description: "Oversee platform integrity, review audit trails, manage user permissions, and ensure system operational stability.",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
  },
};

// Profile data structure stored in Supabase authentication metadata or database profiles
export interface UserProfile {
  id: string;                         // Corresponds directly to auth.users.id
  email: string;                      // User primary email address
  fullName: string;                   // User full name / contact person
  role: UserRole;                     // Assigned application role
  organisationName?: string;          // Name of the agribusiness or financial institution
  phoneNumber?: string;               // Contact phone number (Nigerian MSISDN format)
  createdAt?: string;                 // ISO 8601 timestamp of registration
  updatedAt?: string;                 // ISO 8601 timestamp of last profile update
}

// Client-side authentication state container
export interface AuthState {
  user: UserProfile | null;           // Populated when authenticated, null when logged out
  isLoading: boolean;                 // Flag indicating whether auth session check is in progress
  error: string | null;               // Formatted error message if an auth operation fails
}
