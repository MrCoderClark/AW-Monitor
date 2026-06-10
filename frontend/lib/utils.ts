import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { BackupRunStatus, PCStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_CONFIG: Record<PCStatus, { label: string; color: string; bg: string }> = {
  ONLINE: { label: "Online", color: "text-status-online", bg: "bg-status-online-muted" },
  DEGRADED: { label: "Degraded", color: "text-status-degraded", bg: "bg-status-degraded-muted" },
  OFFLINE: { label: "Offline", color: "text-status-offline", bg: "bg-status-offline-muted" },
  AUTH_FAILED: { label: "Auth Failed", color: "text-status-auth", bg: "bg-status-auth-muted" },
  SMB_BLOCKED: { label: "SMB Blocked", color: "text-status-smb", bg: "bg-status-smb-muted" },
  UNKNOWN: { label: "Unknown", color: "text-status-unknown", bg: "bg-neutral-800" },
};

export const BACKUP_STATUS_CONFIG: Record<BackupRunStatus, { label: string; color: string }> = {
  SUCCESS: { label: "Success", color: "text-status-online" },
  PARTIAL: { label: "Partial", color: "text-status-degraded" },
  FAILURE: { label: "Failed", color: "text-status-offline" },
  NO_FILES: { label: "No Files", color: "text-status-unknown" },
};

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
