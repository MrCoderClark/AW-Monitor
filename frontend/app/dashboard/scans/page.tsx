"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal, Eye, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { DataTable, type Column } from "@/components/data-table";
import { TrendSparkline } from "@/components/trend-sparkline";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/utils";
import type { BackupFile, FileListResponse, FolderDate, ScanSnapshot } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PAGE_SIZE = 50;

function FileActions({ file }: { file: BackupFile }) {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const downloadUrl = `${API_BASE}/api/files/${file.id}/download`;

  const handleView = () => {
    window.open(downloadUrl + `?token=${token}`, "_blank");
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — could show a toast
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center size-6 rounded text-neutral-500 hover:text-white hover:bg-surface-2 transition-colors">
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom">
        <DropdownMenuItem onClick={handleView}>
          <Eye className="size-3.5 mr-2" />
          View PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownload}>
          <Download className="size-3.5 mr-2" />
          Download
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
  {
    key: "actions",
    header: "",
    className: "w-10",
    render: (f) => <FileActions file={f} />,
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
  const [page, setPage] = useState(0);

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

  const skip = page * PAGE_SIZE;
  const { data: fileData, isLoading: filesLoading } = useQuery({
    queryKey: ["files", selectedDate, page],
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        skip: String(skip),
      });
      if (selectedDate) params.set("folder_date", selectedDate);
      return apiFetch<FileListResponse>(`/api/files?${params}`);
    },
    refetchInterval: 30_000,
  });

  const totalPages = fileData ? Math.ceil(fileData.total / PAGE_SIZE) : 0;

  const handleDateChange = (value: string) => {
    setSelectedDate(value || null);
    setPage(0);
  };

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
              onChange={(e) => handleDateChange(e.target.value)}
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-subtle">
            <span className="text-xs text-neutral-500">
              Page {page + 1} of {totalPages}
              <span className="ml-2 text-neutral-600">
                ({skip + 1}–{Math.min(skip + PAGE_SIZE, fileData?.total || 0)} of {fileData?.total.toLocaleString()})
              </span>
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-neutral-400 disabled:text-neutral-700"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="text-neutral-400 disabled:text-neutral-700"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
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
