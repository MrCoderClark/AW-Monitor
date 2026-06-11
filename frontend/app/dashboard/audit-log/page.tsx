"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import type { AuditLogListResponse } from "@/lib/types";

const PAGE_SIZE = 50;

const ACTION_COLORS: Record<string, string> = {
  login: "text-status-online",
  logout: "text-neutral-400",
  login_failed: "text-status-offline",
  account_locked: "text-status-offline",
  password_change: "text-status-degraded",
  user_created: "text-aw-accent",
  user_updated: "text-aw-accent",
  user_deleted: "text-status-offline",
  role_changed: "text-status-degraded",
  config_updated: "text-status-degraded",
  config_revealed: "text-status-offline",
};

export default function AuditLogPage() {
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("");

  const skip = page * PAGE_SIZE;
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", page, actionFilter],
    queryFn: () => {
      const params = new URLSearchParams({ skip: String(skip), limit: String(PAGE_SIZE) });
      if (actionFilter) params.set("action", actionFilter);
      return apiFetch<AuditLogListResponse>(`/api/audit-log?${params}`);
    },
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const allActions = data?.logs
    ? [...new Set(data.logs.map((l) => l.action))].sort()
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">
          Audit Log
          {data && <span className="ml-2 text-sm text-neutral-500">{data.total} events</span>}
        </h2>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
          className="bg-surface-2 border border-border-subtle rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-aw-accent"
        >
          <option value="">All actions</option>
          {allActions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface-1 rounded-lg border border-border-subtle">
        {isLoading ? (
          <p className="text-neutral-600 text-sm py-8 text-center">Loading...</p>
        ) : !data || data.logs.length === 0 ? (
          <p className="text-neutral-600 text-sm py-8 text-center">No audit log entries found.</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {data.logs.map((log) => (
              <div key={log.id} className="p-3 hover:bg-surface-2/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono font-medium ${ACTION_COLORS[log.action] || "text-neutral-400"}`}>
                      {log.action}
                    </span>
                    {log.resource && (
                      <span className="text-xs text-neutral-500">{log.resource}</span>
                    )}
                  </div>
                  <span className="text-2xs text-neutral-600">{formatRelativeTime(log.created_at)}</span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  {log.user_id && (
                    <span className="text-2xs text-neutral-600 font-mono">user:{log.user_id.slice(0, 8)}</span>
                  )}
                  {log.ip_address && (
                    <span className="text-2xs text-neutral-700 font-mono">{log.ip_address}</span>
                  )}
                </div>
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="mt-1.5 bg-surface-2 rounded px-2 py-1">
                    <pre className="text-2xs text-neutral-500 font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-border-subtle">
            <span className="text-xs text-neutral-500">
              Page {page + 1} of {totalPages}
              <span className="ml-2 text-neutral-600">
                ({skip + 1}–{Math.min(skip + PAGE_SIZE, data?.total || 0)} of {data?.total.toLocaleString()})
              </span>
            </span>
            <div className="flex items-center gap-1">
              <Button size="icon-xs" variant="ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="text-neutral-400 disabled:text-neutral-700">
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="icon-xs" variant="ghost" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="text-neutral-400 disabled:text-neutral-700">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
