"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRequireSession, clearSession } from "@/lib/session";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reports", label: "Reports" },
  { href: "/tickets", label: "Helpdesk" },
  { href: "/invoices", label: "Billing" },
  { href: "/notices", label: "Notices" },
  { href: "/residents", label: "Residents" },
  { href: "/parking", label: "Parking" },
  { href: "/audit", label: "Audit log" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = useRequireSession();
  const pathname = usePathname() ?? "";
  const router = useRouter();

  // Login page renders standalone (no session yet).
  if (!session) return <div style={{ minHeight: "100vh" }}>{children}</div>;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-dot" aria-hidden />
          <span>SocietyOS</span>
        </div>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`nav-item${pathname.startsWith(n.href) ? " active" : ""}`}
            aria-current={pathname.startsWith(n.href) ? "page" : undefined}
          >
            <span>{n.label}</span>
          </Link>
        ))}
        {session.isPlatformSuperAdmin && (
          <Link
            href="/platform"
            className={`nav-item${pathname.startsWith("/platform") ? " active" : ""}`}
          >
            <span>Platform</span>
          </Link>
        )}
        <div className="spacer" />
        <button
          className="btn secondary sm"
          onClick={() => {
            clearSession();
            router.push("/login");
          }}
        >
          Sign out
        </button>
        <div className="sidebar-user">
          {session.name} · {session.communityName}
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
