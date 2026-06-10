"use client";

import { useState } from "react";
import type { PCHealthSnapshot, PCStatus } from "@/lib/types";
import { PCTile } from "./pc-tile";
import { PCSlideOver } from "./pc-slide-over";

const STATUS_PRIORITY: PCStatus[] = ["OFFLINE", "AUTH_FAILED", "SMB_BLOCKED", "DEGRADED", "ONLINE", "UNKNOWN"];

interface HealthGridProps {
  snapshots: PCHealthSnapshot[];
}

export function HealthGrid({ snapshots }: HealthGridProps) {
  const [selectedPCId, setSelectedPCId] = useState<string | null>(null);

  const sorted = [...snapshots].sort((a, b) => {
    return STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status);
  });

  const selectedPC = snapshots.find((s) => s.pc_id === selectedPCId);

  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {sorted.map((snapshot) => (
          <PCTile key={snapshot.pc_id} snapshot={snapshot} onClick={() => setSelectedPCId(snapshot.pc_id)} />
        ))}
      </div>

      {selectedPC && (
        <PCSlideOver pc={selectedPC} onClose={() => setSelectedPCId(null)} />
      )}
    </>
  );
}
