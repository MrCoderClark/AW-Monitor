"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import type { Role } from "@/lib/types";

const ROLE_LEVEL: Record<Role, number> = { SUPER_ADMIN: 4, ADMIN: 3, MANAGER: 2, USER: 1 };

interface NavItem {
  href: string;
  label: string;
  icon: string;
  minRole: Role;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "◉", minRole: "USER" },
  { href: "/dashboard/pcs", label: "PCs", icon: "◫", minRole: "USER" },
  { href: "/dashboard/backup-runs", label: "Backups", icon: "↻", minRole: "USER" },
  { href: "/dashboard/scans", label: "Scans", icon: "⊞", minRole: "USER" },
  { href: "/dashboard/config", label: "Config", icon: "⚙", minRole: "ADMIN" },
  { href: "/dashboard/users", label: "Users", icon: "◎", minRole: "ADMIN" },
  { href: "/dashboard/audit-log", label: "Audit", icon: "☰", minRole: "ADMIN" },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const userLevel = user ? ROLE_LEVEL[user.role] : 0;

  const visibleItems = NAV_ITEMS.filter((item) => userLevel >= ROLE_LEVEL[item.minRole]);

  return (
    <aside className="w-14 hover:w-44 transition-all duration-200 bg-surface-1 border-r border-border-subtle flex flex-col py-4 group overflow-hidden">
      <div className="px-3 mb-6">
        <span className="text-aw-accent font-bold text-lg">AW</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded text-sm transition-colors",
                isActive ? "bg-aw-accent-subtle text-aw-accent" : "text-neutral-400 hover:text-neutral-200 hover:bg-surface-2"
              )}
            >
              <span className="w-5 text-center shrink-0">{item.icon}</span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-2 mt-auto">
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-3 px-2 py-2 rounded text-sm text-neutral-400 hover:text-neutral-200 hover:bg-surface-2"
        >
          <span className="w-5 text-center shrink-0">{"⊕"}</span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Profile</span>
        </Link>
      </div>
    </aside>
  );
}
