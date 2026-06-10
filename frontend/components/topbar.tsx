"use client";

import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";

export function Topbar() {
  const { user, logout } = useAuthStore();

  return (
    <header className="h-12 bg-surface-1 border-b border-border-subtle flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-neutral-300">Operations Dashboard</h2>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <>
            <Badge variant="outline" className="text-2xs text-aw-accent border-aw-accent/30 bg-aw-accent-subtle">
              {user.role.replace("_", " ")}
            </Badge>
            <span className="text-xs text-neutral-300">
              {user.first_name} {user.last_name}
            </span>
            <button onClick={logout} className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
              Sign out
            </button>
          </>
        )}
      </div>
    </header>
  );
}
