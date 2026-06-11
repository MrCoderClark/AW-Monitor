"use client";

import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api";
import type { HealthCheck, PCDetailStats, PCHealthSnapshot } from "@/lib/types";
import { PCStatusBadge } from "./status-badge";
import { formatRelativeTime } from "@/lib/utils";

const TIER_LABELS = ["ICMP Ping", "SMB Port 445", "Admin Share Auth", "Folder Access"];

interface PCSlideOverProps {
  pc: PCHealthSnapshot;
  onClose: () => void;
}

export function PCSlideOver({ pc, onClose }: PCSlideOverProps) {
  const { data: detail } = useQuery({
    queryKey: ["pc-detail", pc.pc_id],
    queryFn: () => apiFetch<PCDetailStats>(`/api/pcs/${pc.pc_id}/detail`),
  });

  const { data: history } = useQuery({
    queryKey: ["pc-health", pc.pc_id],
    queryFn: () => apiFetch<HealthCheck[]>(`/api/pcs/${pc.pc_id}/health?limit=20`),
  });

  const latestCheck = detail?.latest_check;
  const tierTimings = latestCheck?.details?.tier_timings as Record<string, number> | undefined;
  const foldersFound = latestCheck?.details?.folders_found as string[] | undefined;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="bg-surface-1 border-border-subtle w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-white flex items-center gap-3">
            {pc.pc_name}
            <PCStatusBadge status={pc.status} />
          </SheetTitle>
          <p className="font-mono text-xs text-neutral-500">{pc.ip_address}</p>
        </SheetHeader>

        <div className="mt-6 space-y-5 px-4">
          {detail && (
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Uptime 24h" value={`${detail.uptime_pct}%`} color={detail.uptime_pct >= 90 ? "text-status-online" : detail.uptime_pct > 0 ? "text-status-degraded" : "text-status-offline"} />
              <MiniStat label="Checks 24h" value={String(detail.checks_24h)} />
              <MiniStat label="Online" value={`${detail.online_24h}/${detail.checks_24h}`} />
            </div>
          )}

          {latestCheck && (
            <div>
              <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Diagnostic Tiers</h4>
              <div className="space-y-1">
                {TIER_LABELS.map((label, i) => {
                  const passed = latestCheck.tier_reached > i;
                  const current = latestCheck.tier_reached === i;
                  const timingKeys = ["ping_ms", "smb_ms", "auth_ms", "folder_ms"];
                  const timing = tierTimings?.[timingKeys[i]];

                  return (
                    <div key={label} className="flex items-center justify-between py-1 px-2 rounded bg-surface-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${passed ? "bg-status-online" : current ? "bg-status-degraded" : "bg-neutral-700"}`} />
                        <span className="text-xs text-neutral-300">{label}</span>
                      </div>
                      <span className="font-mono text-2xs text-neutral-600">
                        {timing != null ? `${timing.toFixed(0)}ms` : passed ? "OK" : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {latestCheck.failure_reason && (
                <p className="text-xs text-status-offline mt-2 px-2">{latestCheck.failure_reason}</p>
              )}
            </div>
          )}

          {latestCheck && (
            <div>
              <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Latest Check</h4>
              <div className="space-y-1.5 text-xs">
                <Row label="Status" value={latestCheck.status} />
                <Row label="Ping" value={latestCheck.ping_ms != null ? `${latestCheck.ping_ms.toFixed(1)}ms` : "—"} />
                <Row label="Tier Reached" value={`${latestCheck.tier_reached}/4`} />
                <Row label="Checked" value={formatRelativeTime(latestCheck.checked_at)} />
              </div>
            </div>
          )}

          {foldersFound && foldersFound.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
                Shared Folders ({foldersFound.length})
              </h4>
              <div className="max-h-24 overflow-y-auto space-y-0.5">
                {foldersFound.map((f) => (
                  <div key={f} className="font-mono text-2xs text-neutral-400 px-2 py-0.5 bg-surface-2 rounded">
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail && detail.recent_backup_failures.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-wider text-status-offline mb-2">Backup Failures</h4>
              <div className="space-y-1">
                {detail.recent_backup_failures.map((date) => (
                  <div key={date} className="text-xs text-neutral-400 px-2 py-1 bg-surface-2 rounded">
                    Failed in run at {formatRelativeTime(date)}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Recent Checks</h4>
            <div className="space-y-1 max-h-[30vh] overflow-y-auto">
              {history?.map((check) => (
                <div key={check.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-surface-2">
                  <PCStatusBadge status={check.status} />
                  <span className="font-mono text-2xs text-neutral-600">
                    {check.ping_ms ? `${check.ping_ms.toFixed(0)}ms` : "—"}
                  </span>
                  <span className="font-mono text-2xs text-neutral-600">T{check.tier_reached}/4</span>
                  <span className="text-2xs text-neutral-600">{formatRelativeTime(check.checked_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({ label, value, color = "text-white" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface-2 rounded px-2 py-1.5 text-center">
      <p className="text-2xs uppercase text-neutral-600">{label}</p>
      <p className={`font-mono text-sm font-medium ${color}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-2">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-300 font-mono">{value}</span>
    </div>
  );
}
