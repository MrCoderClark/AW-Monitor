"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { formatRelativeTime } from "@/lib/utils";
import type { Session } from "@/lib/types";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => apiFetch<Session[]>("/api/auth/sessions"),
  });

  const changePwMutation = useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      apiFetch("/api/auth/change-password", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      setPwMessage({ type: "success", text: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => setPwMessage({ type: "error", text: err.message }),
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`/api/auth/sessions/${sessionId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  const handleChangePw = (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "Passwords do not match" });
      return;
    }
    if (newPassword.length < 8) {
      setPwMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }
    changePwMutation.mutate({ current_password: currentPassword, new_password: newPassword });
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-lg font-medium text-white">Profile</h2>

      <div className="bg-surface-1 rounded-lg border border-border-subtle p-4 space-y-3">
        <h3 className="text-xs uppercase tracking-wider text-neutral-500">Account Info</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-2xs text-neutral-600 uppercase">Name</span>
            <p className="text-sm text-white">{user.first_name} {user.last_name}</p>
          </div>
          <div>
            <span className="text-2xs text-neutral-600 uppercase">Email</span>
            <p className="text-sm text-white font-mono">{user.email}</p>
          </div>
          <div>
            <span className="text-2xs text-neutral-600 uppercase">Role</span>
            <p className="text-sm text-aw-accent">{user.role}</p>
          </div>
          <div>
            <span className="text-2xs text-neutral-600 uppercase">Member Since</span>
            <p className="text-sm text-neutral-400">{new Date(user.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-surface-1 rounded-lg border border-border-subtle p-4">
        <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Change Password</h3>
        <form onSubmit={handleChangePw} className="space-y-3 max-w-sm">
          <div>
            <Label className="text-neutral-400 text-xs">Current Password</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="bg-surface-2 border-border-subtle text-white text-sm h-8" />
          </div>
          <div>
            <Label className="text-neutral-400 text-xs">New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="bg-surface-2 border-border-subtle text-white text-sm h-8" />
          </div>
          <div>
            <Label className="text-neutral-400 text-xs">Confirm New Password</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="bg-surface-2 border-border-subtle text-white text-sm h-8" />
          </div>
          {pwMessage && (
            <p className={`text-xs ${pwMessage.type === "success" ? "text-status-online" : "text-status-offline"}`}>
              {pwMessage.text}
            </p>
          )}
          <Button type="submit" size="sm" disabled={changePwMutation.isPending} className="bg-aw-accent hover:bg-aw-accent-muted text-white">
            {changePwMutation.isPending ? "Changing..." : "Change Password"}
          </Button>
        </form>
      </div>

      <div className="bg-surface-1 rounded-lg border border-border-subtle p-4">
        <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
          Active Sessions
          <span className="ml-2 text-neutral-600">{sessions.length}</span>
        </h3>
        {sessions.length === 0 ? (
          <p className="text-neutral-600 text-sm">No active sessions.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between py-2 px-3 rounded bg-surface-2">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white font-mono">{session.ip_address || "Unknown IP"}</span>
                    {session.device_info && (
                      <span className="text-2xs text-neutral-500">{session.device_info}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-2xs text-neutral-600">Created {formatRelativeTime(session.created_at)}</span>
                    <span className="text-2xs text-neutral-700">Expires {formatRelativeTime(session.expires_at)}</span>
                  </div>
                </div>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-neutral-500 hover:text-status-offline"
                  onClick={() => revokeSessionMutation.mutate(session.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
