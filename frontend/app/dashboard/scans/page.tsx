"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { DataTable, type Column } from "@/components/data-table";
import { TrendSparkline } from "@/components/trend-sparkline";
import { formatRelativeTime } from "@/lib/utils";
import type { BackupFile, FileListResponse, FolderDate, ScanSnapshot } from "@/lib/types";

const fileColumns: Column<BackupFile>[] = [
  {
    key: "filename",
    header: "Filename",
    render: (f) => (
      <span className="font-mono text-xs text-neutral-200 max-w-[300px] truncate block">
        {f.filename}
      </span>
    ),
  },
  {
    key: "assessment_type",
    header: "Assessment",
    render: (f) => (
      <span className="text-xs text-aw-accent">
        {f.assessment_type?.replace(/_/g, " ") || "Unknown"}
      </span>
    ),
  },
  {
    key: "client_name",
    header: "Client",
    render: (f) =>
      f.client_first_name || f.client_last_name ? (
        <span className="text-xs text-neutral-300">
          {f.client_first_name} {f.client_last_name}
        </span>
      ) : (
        <span className="text-xs text-neutral-600">—</span>
      ),
  },
  {
    key: "file_size",
    header: "Size",
    className: "text-right",
    render: (f) => (
      <span className="font-mono text-xs text-neutral-400">
        {(f.file_size / 1024).toFixed(0)} KB
      </span>
    ),
  },
  {
    key: "modified_date",
    header: "Modified",
    render: (f) => (
      <span className="text-xs text-neutral-500">
        {f.modified_date ? formatRelativeTime(f.modified_date) : "—"}
      </span>
    ),
  },
];

const scanHistoryColumns: Column<ScanSnapshot>[] = [
  {
    key: "captured_at",
    header: "When",
    render: (s) => (
      <span className="text-neutral-400 text-xs">{formatRelativeTime(s.captured_at)}</span>
    ),
  },
  {
    key: "total_files",
    header: "Total Files",
    className: "text-right",
    render: (s) => (
      <span className="font-mono text-white">{s.total_files.toLocaleString()}</span>
    ),
  },
  {
    key: "new_files",
    header: "New Files",
    className: "text-right",
    render: (s) => (
      <span className={`font-mono ${s.new_files > 0 ? "text-status-online" : "text-neutral-500"}`}>
        {s.new_files > 0 ? "+" : ""}{s.new_files.toLocaleString()}
      </span>
    ),
  },
  {
    key: "storage_total",
    header: "Storage",
    className: "text-right",
    render: (s) => (
      <span className="font-mono text-neutral-400">{s.storage_total || "—"}</span>
    ),
  },
];

export default function ScansPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: latest } = useQuery({
    queryKey: ["scans-latest"],
    queryFn: () => apiFetch<ScanSnapshot | null>("/api/scans/latest"),
    refetchInterval: 30_000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["scans-history"],
    queryFn: () => apiFetch<ScanSnapshot[]>("/api/scans/history?limit=100"),
    refetchInterval: 30_000,
  });

  const { data: folderDates = [] } = useQuery({
    queryKey: ["file-dates"],
    queryFn: () => apiFetch<FolderDate[]>("/api/files/dates"),
    refetchInterval: 60_000,
  });

  const { data: fileData, isLoading: filesLoading } = useQuery({
    queryKey: ["files", selectedDate],
    queryFn: () => {
      const params = selectedDate ? `?folder_date=${selectedDate}&limit=200` : "?limit=200";
      return apiFetch<FileListResponse>(`/api/files${params}`);
    },
    refetchInterval: 30_000,
  });

  const trendData = [...history]
    .reverse()
    .map((s) => ({
      label: new Date(s.captured_at).toLocaleDateString(),
      value: s.total_files,
    }));

  const newFilesTrend = [...history]
    .reverse()
    .map((s) => ({
      label: new Date(s.captured_at).toLocaleDateString(),
      value: s.new_files,
    }));

  const filesByType = latest?.files_by_type;

  return (
    <div className="space-y-4">
      {latest && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total Files" value={latest.total_files.toLocaleString()} />
          <StatCard
            label="New Files"
            value={`${latest.new_files > 0 ? "+" : ""}${latest.new_files.toLocaleString()}`}
            valueClass={latest.new_files > 0 ? "text-status-online" : "text-neutral-400"}
          />
          <StatCard label="Total Storage" value={latest.storage_total || "—"} />
          <StatCard
            label="Last Scan"
            value={formatRelativeTime(latest.captured_at)}
            valueClass="text-neutral-400"
          />
        </div>
      )}

      {trendData.length > 1 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-1 rounded-lg border border-border-subtle p-4">
            <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
              Total Files Trend
            </h3>
            <TrendSparkline data={trendData} color="var(--color-aw-accent)" height={80} />
          </div>
          <div className="bg-surface-1 rounded-lg border border-border-subtle p-4">
            <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
              New Files Trend
            </h3>
            <TrendSparkline data={newFilesTrend} color="var(--color-status-online)" height={80} />
          </div>
        </div>
      )}

      <div className="bg-surface-1 rounded-lg border border-border-subtle p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500">
            Backed Up Files
            {fileData && (
              <span className="ml-2 text-neutral-600">{fileData.total.toLocaleString()} total</span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={selectedDate || ""}
              onChange={(e) => setSelectedDate(e.target.value || null)}
              className="bg-surface-2 border border-border-subtle rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-aw-accent"
            >
              <option value="">All dates</option>
              {folderDates.map((d) => (
                <option key={d.folder_date} value={d.folder_date}>
                  {d.folder_date} ({d.file_count})
                </option>
              ))}
            </select>
          </div>
        </div>
        {filesLoading ? (
          <p className="text-neutral-600 text-sm py-8 text-center">Loading...</p>
        ) : (
          <DataTable
            columns={fileColumns}
            data={fileData?.files || []}
            keyFn={(f) => f.id}
            emptyMessage="No files found. Configure express_api.base_url to connect."
          />
        )}
      </div>

      {filesByType && Object.keys(filesByType).length > 0 && (
        <div className="bg-surface-1 rounded-lg border border-border-subtle p-4">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
            Files by Assessment Type
          </h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(filesByType)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([type, count]) => (
                <div key={type} className="bg-surface-2 rounded px-3 py-1.5">
                  <span className="text-xs font-mono text-aw-accent">{type.replace(/_/g, " ")}</span>
                  <span className="text-xs font-mono text-neutral-400 ml-2">{(count as number).toLocaleString()}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-surface-1 rounded-lg border border-border-subtle p-4">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
            Scan History
          </h3>
          <DataTable
            columns={scanHistoryColumns}
            data={history}
            keyFn={(s) => s.id}
            emptyMessage="No scan snapshots yet."
          />
        </div>
      )}
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
