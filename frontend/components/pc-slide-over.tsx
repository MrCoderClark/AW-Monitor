"use client";

import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api";
import type { HealthCheck, PCHealthSnapshot } from "@/lib/types";
import { PCStatusBadge } from "./status-badge";
import { formatRelativeTime } from "@/lib/utils";

interface PCSlideOverProps {
  pc: PCHealthSnapshot;
  onClose: () => void;
}

export function PCSlideOver({ pc, onClose }: PCSlideOverProps) {
  const { data: history } = useQuery({
    queryKey: ["pc-health", pc.pc_id],
    queryFn: () => apiFetch<HealthCheck[]>(`/api/pcs/${pc.pc_id}/health?limit=20`),
  });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="bg-surface-1 border-border-subtle w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-white flex items-center gap-3">
            {pc.pc_name}
            <PCStatusBadge status={pc.status} />
          </SheetTitle>
          <p className="font-mono text-xs text-neutral-500">{pc.ip_address}</p>
        </SheetHeader>

        <div className="mt-6 space-y-3 px-4">
          <h4 className="text-xs uppercase tracking-wider text-neutral-500">Recent Checks</h4>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {history?.map((check) => (
              <div key={check.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-surface-2">
                <PCStatusBadge status={check.status} />
                <span className="font-mono text-2xs text-neutral-600">
                  {check.ping_ms ? `${check.ping_ms.toFixed(0)}ms` : "—"}
                </span>
                <span className="text-2xs text-neutral-600">{formatRelativeTime(check.checked_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
