/**
 * Format a share link's last-accessed ISO timestamp for the owner's dialog
 * (e.g. "Jun 17, 3:30 PM"). Pure — lifted out of ShareDialog so it's unit-testable
 * (ENH-CQ-03). Uses the runner's local time zone, like any client-side date render.
 */
export function formatAccessed(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
