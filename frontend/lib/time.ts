/**
 * FinSight Time Formatting Utilities
 *
 * All timestamps from the FinSight API are UTC-aware ISO 8601 strings
 * (e.g. "2026-09-12T10:12:40+00:00"). This module converts them to the
 * user's local browser timezone for display.
 *
 * Approach:
 * - Uses the browser's built-in `Intl.DateTimeFormat` API (zero dependencies).
 * - Reads the user's local timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`
 *   so it works correctly for both Indian (IST) and US (ET/PT) users without
 *   any hardcoded offsets.
 * - No daylight saving edge cases — the browser handles DST automatically.
 */

/**
 * Formats a UTC ISO 8601 timestamp into the user's local date and time.
 *
 * @example
 * formatLocalDate("2026-10-01T00:00:00+00:00")
 * // Indian user (IST):  "1 Oct 2026, 5:30 am"
 * // US Eastern (EDT):   "Sep 30, 2026, 8:00 pm"
 */
export function formatLocalDate(isoUtc: string): string {
  return new Date(isoUtc).toLocaleString(undefined, {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Formats only the date portion of a UTC ISO 8601 timestamp in the user's local timezone.
 *
 * @example
 * formatLocalDateOnly("2026-10-01T00:00:00+00:00")
 * // Indian user: "1 Oct 2026" (still Oct 1st — UTC midnight = 5:30 AM IST, same day)
 * // US ET user:  "Sep 30, 2026" (UTC midnight = 8 PM ET previous day)
 */
export function formatLocalDateOnly(isoUtc: string): string {
  return new Date(isoUtc).toLocaleDateString(undefined, {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Returns a human-readable quota reset message relative to now.
 * Used for the quota progress bar tooltip and usage modal.
 *
 * @example
 * formatQuotaReset("2026-10-01T00:00:00+00:00")
 * // → "Resets tonight" (if today is Sep 30)
 * // → "Resets tomorrow" (if today is Sep 30 and reset is next day)
 * // → "Resets in 15 days"
 * // → "Resets 1 Oct"
 */
export function formatQuotaReset(isoUtc: string): string {
  const resetDate = new Date(isoUtc);
  const now = new Date();

  // Diff in calendar days in the user's local timezone
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const resetLocal = new Date(resetDate.toLocaleString("en-US", { timeZone: userTz }));
  const nowLocal = new Date(now.toLocaleString("en-US", { timeZone: userTz }));

  const msPerDay = 86400000;
  const diffDays = Math.ceil((resetLocal.getTime() - nowLocal.getTime()) / msPerDay);

  if (diffDays <= 0) return "Resets tonight";
  if (diffDays === 1) return "Resets tomorrow";
  if (diffDays <= 7) return `Resets in ${diffDays} days`;

  return `Resets ${resetDate.toLocaleDateString(undefined, {
    timeZone: userTz,
    day: "numeric",
    month: "short",
  })}`;
}

/**
 * Returns a relative "time ago" string for news and event timestamps.
 *
 * @example
 * formatTimeAgo("2026-09-12T10:00:00+00:00")
 * // → "2 hours ago"
 * // → "3 days ago"
 * // → "just now"
 */
export function formatTimeAgo(isoUtc: string): string {
  const date = new Date(isoUtc);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;

  return formatLocalDateOnly(isoUtc);
}

/**
 * Returns whether a market is currently open based on server-provided boolean.
 * Displays a colored badge label.
 *
 * @example
 * marketStatusLabel(true)  // → { label: "Market Open", color: "green" }
 * marketStatusLabel(false) // → { label: "Market Closed", color: "red" }
 */
export function marketStatusLabel(isOpen: boolean): { label: string; color: string } {
  return isOpen
    ? { label: "Market Open", color: "green" }
    : { label: "Market Closed", color: "red" };
}
