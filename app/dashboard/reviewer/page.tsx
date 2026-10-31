import { redirect } from "next/navigation";

/**
 * Financing Reviewer route alias: redirects to /dashboard/financier
 * adhering to the database schema role identifier 'financier'.
 */
export default function ReviewerRouteRedirect() {
  redirect("/dashboard/financier");
}
