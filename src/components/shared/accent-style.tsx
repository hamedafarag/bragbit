import { accentCss } from "@/lib/utils";

/**
 * Emits a page's per-workspace brand accent as `:root` custom properties.
 *
 * Render this once per branded surface (the app shell, the auth pages, a share
 * page, the print view) instead of putting `accentVars` on a wrapper element.
 * Wrapper-scoped variables never reach Radix dialogs (portalled into
 * `document.body`) or sonner toasts (mounted in the root layout), so those
 * surfaces silently rendered in the default palette on a white-labeled workspace.
 *
 * Renders nothing when the workspace has no valid accent, leaving the default
 * palette in globals.css untouched.
 */
export function AccentStyle({ accent }: { accent?: string | null }) {
  const css = accentCss(accent);
  if (!css) return null;

  // Safe: accentCss only emits a regex-validated hex plus one of two literal
  // foreground colors — no caller-controlled text reaches the stylesheet. The
  // CSP (src/proxy.ts) restricts script-src only, so an inline style is fine.
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
