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
      <aside className="side">
        <div className="brand">SocietyOS</div>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="nav-item"
            style={pathname.startsWith(n.href) ? { background: "#16223a", color: "var(--text)" } : undefined}
          >
            {n.label}
          </Link>
        ))}
        {session.isPlatformSuperAdmin && (
          <Link
            href="/platform"
            className="nav-item"
            style={{ color: "var(--warn)", ...((pathname.startsWith("/platform") ? { background: "#16223a" } : {})) }}
          >
            ⚡ Platform
          </Link>
        )}
        <div style={{ flex: 1 }} />
        <div className="muted" style={{ fontSize: 12, padding: "0 10px 8px" }}>
          {session.name}
          <br />
          {session.communityName}
        </div>
        <button
          className="ghost"
          onClick={() => {
            clearSession();
            router.push("/login");
          }}
        >
          Sign out
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
