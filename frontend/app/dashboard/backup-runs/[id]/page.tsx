"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { BackupStatusBadge } from "@/components/status-badge";
import type { BackupRun } from "@/lib/types";

export default function BackupRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: run, isLoading } = useQuery({
    queryKey: ["backup-run", id],
    queryFn: () => apiFetch<BackupRun>(`/api/backup-runs/${id}`),
  });

  if (isLoading) {
    return <p className="text-neutral-600 text-sm py-8 text-center">Loading...</p>;
  }

  if (!run) {
    return <p className="text-neutral-600 text-sm py-8 text-center">Run not found.</p>;
  }

  const received = new Date(run.received_at);

  return (
    <div className="space-y-4 max-w-3xl">
      <button
        onClick={() => router.push("/dashboard/backup-runs")}
        className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        ← Back to runs
      </button>

      <div className="bg-surface-1 rounded-lg border border-border-subtle p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-medium text-neutral-200">
            Backup Run — {run.date_folder || "N/A"}
          </h2>
          <BackupStatusBadge status={run.status} />
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <Field label="Files Copied" value={run.files_copied.toLocaleString()} />
          <Field label="Files Skipped" value={run.files_skipped.toLocaleString()} />
          <Field label="Duplicates" value={run.duplicates.toLocaleString()} />
          <Field label="Total Size" value={`${run.total_size_mb.toFixed(2)} MB`} />
          <Field label="Duration" value={`${run.duration_seconds.toFixed(1)}s`} />
          <Field label="PCs Scanned" value={run.pcs_scanned.toString()} />
          <Field
            label="Received"
            value={`${received.toLocaleDateString()} ${received.toLocaleTimeString()}`}
          />
          <Field label="Date Folder" value={run.date_folder || "—"} />
        </div>
      </div>

      {run.pcs_failed && run.pcs_failed.length > 0 && (
        <div className="bg-surface-1 rounded-lg border border-border-subtle p-5">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
            Failed PCs ({run.pcs_failed.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {run.pcs_failed.map((pc) => (
              <span
                key={pc}
                className="px-2 py-1 rounded bg-status-offline-muted text-status-offline text-xs font-mono"
              >
                {pc}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="text-sm font-mono text-neutral-200 mt-0.5">{value}</p>
    </div>
  );
}
