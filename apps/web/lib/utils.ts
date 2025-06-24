import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format status strings to be more user-friendly
 * Replaces underscores and dashes with spaces and capitalizes each word
 */
export function formatStatusText(status: string): string {
  if (!status) return ""

  return status
    .replace(/[_-]/g, " ") // Replace underscores and dashes with spaces
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize each word
    .join(" ")
}
