"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Tab({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-mb-px border-b-2 px-1 py-2.5 font-mono text-[11.5px] tracking-[0.1em] uppercase no-underline ${
        active ? "border-ink text-ink" : "border-transparent text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

/** Tabs across the admin area. Members shows only for organization workspaces. */
export function AdminNav({ isOrg }: { isOrg: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-5 border-b border-line">
      <Tab href="/admin" active={pathname === "/admin"}>
        Branding
      </Tab>
      {isOrg ? (
        <Tab href="/admin/members" active={pathname === "/admin/members"}>
          Members
        </Tab>
      ) : null}
    </nav>
  );
}
