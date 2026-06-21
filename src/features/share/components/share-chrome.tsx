import type { ReactNode } from "react";

import type { ShareBrand } from "@/features/share/queries";
import { accentVars, thumbUrl } from "@/lib/utils";

/**
 * The branded outer chrome for a public share page — a per-workspace accent
 * (`--primary`/`--ring`) wrapper, a header with the workspace logo + name, and the
 * "Powered by BragBit" footer. Both the open timeline and the locked unlock form
 * render inside it, so the page looks the same before and after unlocking.
 */
export function ShareChrome({ brand, children }: { brand: ShareBrand; children: ReactNode }) {
  const logoUrl = brand.logoKey ? `/api/files/${brand.logoKey}` : null;

  return (
    <div className="relative z-10 flex min-h-screen flex-col" style={accentVars(brand.accentColor)}>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[760px] items-center gap-3 px-6 py-4">
          {logoUrl ? (
            // Plain <img> served as a `?w=` webp thumbnail (ENH-PERF-02); next/image can't fetch the session-gated files route.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl(logoUrl, 400)}
              alt={brand.name}
              className="h-7 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <div className="grid size-7 place-items-center rounded-md bg-primary font-serif text-sm font-semibold text-primary-foreground shadow-[inset_0_-6px_10px_rgba(0,0,0,0.18)]">
              {brand.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="font-serif text-[15px] font-semibold">{brand.name}</span>
        </div>
      </header>

      {children}

      <footer className="border-t border-line">
        <div className="mx-auto max-w-[760px] px-6 py-5 font-mono text-[10.5px] text-ink-faint">
          Powered by <span className="font-medium text-ink-soft">BragBit</span>
        </div>
      </footer>
    </div>
  );
}
