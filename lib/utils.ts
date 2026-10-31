import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to conditionally merge Tailwind CSS class names.
 * Combines 'clsx' (for conditional class logic) with 'tailwind-merge'
 * (to automatically resolve conflicting utility classes cleanly).
 *
 * @param inputs - Array or object of class values to combine
 * @returns Clean, resolved string of CSS classes
 */
export function cn(...inputs: ClassValue[]): string {
  // Pass all input class values through clsx, then resolve conflicts via twMerge
  return twMerge(clsx(inputs));
}

/**
 * Formats a numeric value into Nigerian Naira (NGN) currency representation.
 * Agricultural transactions in HarvestLink Finance are primarily denominated in Naira.
 *
 * @param amount - The numerical amount to format
 * @returns Formatted currency string (e.g., "₦1,500,000.00")
 */
export function formatCurrencyNGN(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
