"use client";

import { useQuery } from "@tanstack/react-query";
import { HealthGrid } from "@/components/health-grid";
import { apiFetch } from "@/lib/api";
import { useHealthStream } from "@/hooks/use-health-stream";
import type { DashboardStats } from "@/lib/types";
import { BACKUP_STATUS_CONFIG, formatRelativeTime } from "@/lib/utils";

export default function DashboardPage() {
  const { snapshots, connected } = useHealthStream();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiFetch<DashboardStats>("/api/dashboard/stats"),
    refetchInterval: 30_000,
  });

  const onlineCount = snapshots.filter((s) => s.status === "ONLINE").length;
  const totalCount = snapshots.length;

  return (
    <div className="grid grid-cols-[1fr_380px] gap-4 h-full">
      <div className="bg-surface-1 rounded-lg border border-border-subtle p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500">
            PC Health
            <span className="ml-2 text-neutral-600">
              {onlineCount}/{totalCount}
            </span>
          </h3>
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-status-online" : "bg-status-offline animate-status-pulse"}`} />
        </div>
        <HealthGrid snapshots={snapshots} />
      </div>

      <div className="space-y-4">
        <div className="bg-surface-1 rounded-lg border border-border-subtle p-4">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Latest Backup</h3>
          {stats?.last_run ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Status</span>
                <span className={`text-xs font-medium ${BACKUP_STATUS_CONFIG[stats.last_run.status]?.color}`}>
                  {stats.last_run.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Files Copied</span>
                <span className="text-xs text-white font-mono">{stats.last_run.files_copied}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Skipped</span>
                <span className="text-xs text-neutral-400 font-mono">{stats.last_run.files_skipped}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Duration</span>
                <span className="text-xs text-neutral-400 font-mono">{stats.last_run.duration_seconds.toFixed(1)}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">When</span>
                <span className="text-xs text-neutral-600">{formatRelativeTime(stats.last_run.received_at)}</span>
              </div>
            </div>
          ) : (
            <p className="text-neutral-600 text-sm">No backup runs recorded yet.</p>
          )}
        </div>

        <div className="bg-surface-1 rounded-lg border border-border-subtle p-4">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Quick Stats</h3>
          {stats ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Total Files Indexed</span>
                <span className="text-xs text-white font-mono">{stats.total_files.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">New Files</span>
                <span className={`text-xs font-mono ${stats.new_files > 0 ? "text-status-online" : "text-neutral-400"}`}>
                  {stats.new_files > 0 ? "+" : ""}{stats.new_files.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Storage</span>
                <span className="text-xs text-neutral-400 font-mono">{stats.storage_total || "—"}</span>
              </div>
              {stats.last_scan_at && (
                <div className="flex justify-between">
                  <span className="text-xs text-neutral-500">Last Scan</span>
                  <span className="text-xs text-neutral-600 font-mono">{formatRelativeTime(stats.last_scan_at)}</span>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-border-subtle space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-neutral-500">Backup Runs</span>
                  <span className="text-xs text-white font-mono">{stats.total_runs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-neutral-500">Success Rate</span>
                  <span className={`text-xs font-mono ${stats.success_rate >= 90 ? "text-status-online" : stats.success_rate > 0 ? "text-status-degraded" : "text-neutral-400"}`}>
                    {stats.total_runs > 0 ? `${stats.success_rate}%` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-neutral-500">Avg Duration</span>
                  <span className="text-xs text-neutral-400 font-mono">
                    {stats.total_runs > 0 ? `${stats.avg_duration_seconds}s` : "—"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-neutral-600 text-sm">Loading...</p>
          )}
        </div>
      </div>
    </div>
  );
}
