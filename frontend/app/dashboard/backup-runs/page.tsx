"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { DataTable, type Column } from "@/components/data-table";
import { BackupStatusBadge } from "@/components/status-badge";
import { formatRelativeTime } from "@/lib/utils";
import type { BackupRun, BackupRunStats } from "@/lib/types";

const columns: Column<BackupRun>[] = [
  {
    key: "status",
    header: "Status",
    render: (run) => <BackupStatusBadge status={run.status} />,
  },
  {
    key: "date_folder",
    header: "Date Folder",
    render: (run) => (
      <span className="font-mono text-neutral-300">{run.date_folder || "—"}</span>
    ),
  },
  {
    key: "files_copied",
    header: "Copied",
    className: "text-right",
    render: (run) => (
      <span className="font-mono text-white">{run.files_copied.toLocaleString()}</span>
    ),
  },
  {
    key: "files_skipped",
    header: "Skipped",
    className: "text-right",
    render: (run) => (
      <span className="font-mono text-neutral-400">{run.files_skipped.toLocaleString()}</span>
    ),
  },
  {
    key: "duplicates",
    header: "Dupes",
    className: "text-right",
    render: (run) => (
      <span className="font-mono text-neutral-500">{run.duplicates.toLocaleString()}</span>
    ),
  },
  {
    key: "total_size_mb",
    header: "Size",
    className: "text-right",
    render: (run) => (
      <span className="font-mono text-neutral-400">{run.total_size_mb.toFixed(1)} MB</span>
    ),
  },
  {
    key: "duration_seconds",
    header: "Duration",
    className: "text-right",
    render: (run) => (
      <span className="font-mono text-neutral-400">{run.duration_seconds.toFixed(1)}s</span>
    ),
  },
  {
    key: "pcs_scanned",
    header: "PCs",
    className: "text-right",
    render: (run) => {
      const failCount = run.pcs_failed?.length ?? 0;
      return (
        <span className="font-mono">
          <span className="text-white">{run.pcs_scanned}</span>
          {failCount > 0 && (
            <span className="text-status-offline ml-1">({failCount} fail)</span>
          )}
        </span>
      );
    },
  },
  {
    key: "received_at",
    header: "When",
    render: (run) => (
      <span className="text-neutral-500 text-xs">{formatRelativeTime(run.received_at)}</span>
    ),
  },
];

export default function BackupRunsPage() {
  const router = useRouter();

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["backup-runs"],
    queryFn: () => apiFetch<BackupRun[]>("/api/backup-runs?limit=100"),
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["backup-stats"],
    queryFn: () => apiFetch<BackupRunStats>("/api/backup-runs/stats"),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total Runs" value={stats.total_runs.toString()} />
          <StatCard
            label="Success Rate"
            value={`${stats.success_rate.toFixed(1)}%`}
            valueClass={stats.success_rate >= 90 ? "text-status-online" : stats.success_rate >= 50 ? "text-status-degraded" : "text-status-offline"}
          />
          <StatCard label="Avg Files" value={stats.avg_files_copied.toFixed(0)} />
          <StatCard label="Avg Duration" value={`${stats.avg_duration_seconds.toFixed(1)}s`} />
        </div>
      )}

      <div className="bg-surface-1 rounded-lg border border-border-subtle p-4">
        <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
          Backup Runs
        </h3>
        {isLoading ? (
          <p className="text-neutral-600 text-sm py-8 text-center">Loading...</p>
        ) : (
          <DataTable
            columns={columns}
            data={runs}
            keyFn={(r) => r.id}
            onRowClick={(r) => router.push(`/dashboard/backup-runs/${r.id}`)}
            emptyMessage="No backup runs recorded yet."
          />
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-surface-1 rounded-lg border border-border-subtle p-3">
      <p className="text-2xs uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`text-lg font-mono font-medium mt-1 ${valueClass}`}>{value}</p>
    </div>
  );
}
