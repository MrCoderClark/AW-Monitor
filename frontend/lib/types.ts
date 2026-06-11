export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "USER";

export type PCStatus = "ONLINE" | "OFFLINE" | "SMB_BLOCKED" | "AUTH_FAILED" | "DEGRADED" | "UNKNOWN";

export type BackupRunStatus = "SUCCESS" | "PARTIAL" | "FAILURE" | "NO_FILES";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  is_active: boolean;
  must_change_pw: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface PC {
  id: string;
  name: string;
  ip_address: string;
  location: string | null;
  is_monitored: boolean;
  created_at: string;
  latest_status: PCStatus | null;
  latest_ping_ms: number | null;
}

export interface HealthCheck {
  id: string;
  pc_id: string;
  status: PCStatus;
  ping_ms: number | null;
  tier_reached: number;
  failure_reason: string | null;
  details: Record<string, unknown> | null;
  checked_at: string;
}

export interface PCHealthSnapshot {
  pc_id: string;
  pc_name: string;
  ip_address: string;
  status: PCStatus;
  ping_ms: number | null;
  tier_reached: number;
  failure_reason: string | null;
  checked_at: string | null;
}

export interface PCDetailStats {
  pc: PC;
  latest_check: HealthCheck | null;
  uptime_pct: number;
  checks_24h: number;
  online_24h: number;
  recent_backup_failures: string[];
}

export interface BackupRun {
  id: string;
  files_copied: number;
  files_skipped: number;
  duplicates: number;
  total_size_mb: number;
  duration_seconds: number;
  pcs_scanned: number;
  pcs_failed: string[] | null;
  date_folder: string | null;
  status: BackupRunStatus;
  received_at: string;
}

export interface BackupRunStats {
  total_runs: number;
  avg_duration_seconds: number;
  avg_files_copied: number;
  success_rate: number;
  last_run: BackupRun | null;
}

export interface ScanSnapshot {
  id: string;
  total_files: number;
  new_files: number;
  files_by_type: Record<string, number> | null;
  storage_total: string | null;
  storage_avg: string | null;
  captured_at: string;
}

export interface BackupFile {
  id: string;
  filename: string;
  folder_date: string;
  file_path: string;
  file_size: number;
  assessment_type: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  created_at: string | null;
  modified_date: string | null;
}

export interface FileListResponse {
  files: BackupFile[];
  total: number;
}

export interface FolderDate {
  folder_date: string;
  file_count: number;
}

export interface DashboardStats {
  total_runs: number;
  success_rate: number;
  avg_duration_seconds: number;
  last_run: BackupRun | null;
  total_files: number;
  new_files: number;
  storage_total: string | null;
  last_scan_at: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface ConfigEntry {
  id: string;
  namespace: string;
  key: string;
  value: string | null;
  type: string;
  description: string | null;
  is_sensitive: boolean;
  updated_at: string;
}
