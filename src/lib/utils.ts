import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a date string (YYYY-MM-DD) as local time instead of UTC.
 * Prevents timezone offset from shifting the date by one day.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  // Append T12:00:00 to force midday, avoiding any timezone boundary issues
  if (dateStr.length === 10 && dateStr.includes('-')) {
    return new Date(dateStr + 'T12:00:00');
  }
  return new Date(dateStr);
}
