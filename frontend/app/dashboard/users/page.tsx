"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatRelativeTime } from "@/lib/utils";
import type { User, Role, UserListResponse } from "@/lib/types";

const ROLES: Role[] = ["USER", "MANAGER", "ADMIN", "SUPER_ADMIN"];
const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: "text-aw-accent bg-aw-accent-subtle",
  ADMIN: "text-status-degraded bg-status-degraded-muted",
  MANAGER: "text-status-online bg-status-online-muted",
  USER: "text-neutral-400 bg-neutral-800",
};

const PAGE_SIZE = 20;

interface UserFormData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: Role;
}

interface EditFormData {
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [roleUser, setRoleUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const [createForm, setCreateForm] = useState<UserFormData>({
    email: "", password: "", first_name: "", last_name: "", role: "USER",
  });
  const [editForm, setEditForm] = useState<EditFormData>({
    email: "", first_name: "", last_name: "", is_active: true,
  });
  const [newRole, setNewRole] = useState<Role>("USER");
  const [error, setError] = useState("");

  const skip = page * PAGE_SIZE;
  const { data, isLoading } = useQuery({
    queryKey: ["users", page],
    queryFn: () => apiFetch<UserListResponse>(`/api/users?skip=${skip}&limit=${PAGE_SIZE}`),
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const createMutation = useMutation({
    mutationFn: (body: UserFormData) =>
      apiFetch<User>("/api/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowCreate(false);
      setCreateForm({ email: "", password: "", first_name: "", last_name: "", role: "USER" });
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: EditFormData }) =>
      apiFetch<User>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiFetch<User>(`/api/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setRoleUser(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteUser(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_active: user.is_active,
    });
    setError("");
  };

  const openRole = (user: User) => {
    setRoleUser(user);
    setNewRole(user.role);
    setError("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">
          Users
          {data && <span className="ml-2 text-sm text-neutral-500">{data.total} total</span>}
        </h2>
        <Button
          size="sm"
          className="bg-aw-accent hover:bg-aw-accent-muted text-white"
          onClick={() => { setShowCreate(true); setError(""); }}
        >
          <Plus className="size-3.5 mr-1" /> New User
        </Button>
      </div>

      <div className="bg-surface-1 rounded-lg border border-border-subtle">
        {isLoading ? (
          <p className="text-neutral-600 text-sm py-8 text-center">Loading...</p>
        ) : !data || data.users.length === 0 ? (
          <p className="text-neutral-600 text-sm py-8 text-center">No users found.</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {data.users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 hover:bg-surface-2/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium">
                      {user.first_name} {user.last_name}
                    </span>
                    <span className={`text-2xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[user.role]}`}>
                      {user.role}
                    </span>
                    {!user.is_active && (
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-status-offline-muted text-status-offline">
                        INACTIVE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-0.5">
                    <span className="text-xs text-neutral-500 font-mono">{user.email}</span>
                    <span className="text-2xs text-neutral-700">
                      {user.last_login_at ? `Last login ${formatRelativeTime(user.last_login_at)}` : "Never logged in"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon-xs" variant="ghost" className="text-neutral-500 hover:text-white" onClick={() => openRole(user)}>
                    <Shield className="size-3.5" />
                  </Button>
                  <Button size="icon-xs" variant="ghost" className="text-neutral-500 hover:text-white" onClick={() => openEdit(user)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="icon-xs" variant="ghost" className="text-neutral-500 hover:text-status-offline" onClick={() => setDeleteUser(user)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-border-subtle">
            <span className="text-xs text-neutral-500">Page {page + 1} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <Button size="icon-xs" variant="ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="text-neutral-400 disabled:text-neutral-700">
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="icon-xs" variant="ghost" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="text-neutral-400 disabled:text-neutral-700">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        <DialogContent className="bg-surface-1 border-border-subtle sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Create User</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(createForm); }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-neutral-400 text-xs">First Name</Label>
                <Input value={createForm.first_name} onChange={(e) => setCreateForm((f) => ({ ...f, first_name: e.target.value }))} required className="bg-surface-2 border-border-subtle text-white text-sm h-8" />
              </div>
              <div>
                <Label className="text-neutral-400 text-xs">Last Name</Label>
                <Input value={createForm.last_name} onChange={(e) => setCreateForm((f) => ({ ...f, last_name: e.target.value }))} required className="bg-surface-2 border-border-subtle text-white text-sm h-8" />
              </div>
            </div>
            <div>
              <Label className="text-neutral-400 text-xs">Email</Label>
              <Input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} required className="bg-surface-2 border-border-subtle text-white text-sm h-8" />
            </div>
            <div>
              <Label className="text-neutral-400 text-xs">Password</Label>
              <Input type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} required className="bg-surface-2 border-border-subtle text-white text-sm h-8" />
            </div>
            <div>
              <Label className="text-neutral-400 text-xs">Role</Label>
              <select value={createForm.role} onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as Role }))} className="w-full bg-surface-2 border border-border-subtle rounded px-2 py-1.5 text-sm text-neutral-300 focus:outline-none focus:ring-1 focus:ring-aw-accent">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {error && <p className="text-xs text-status-offline">{error}</p>}
            <DialogFooter>
              <Button type="submit" size="sm" disabled={createMutation.isPending} className="bg-aw-accent hover:bg-aw-accent-muted text-white">
                {createMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="bg-surface-1 border-border-subtle sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (editingUser) updateMutation.mutate({ id: editingUser.id, body: editForm }); }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-neutral-400 text-xs">First Name</Label>
                <Input value={editForm.first_name} onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))} className="bg-surface-2 border-border-subtle text-white text-sm h-8" />
              </div>
              <div>
                <Label className="text-neutral-400 text-xs">Last Name</Label>
                <Input value={editForm.last_name} onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))} className="bg-surface-2 border-border-subtle text-white text-sm h-8" />
              </div>
            </div>
            <div>
              <Label className="text-neutral-400 text-xs">Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="bg-surface-2 border-border-subtle text-white text-sm h-8" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={editForm.is_active} onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded border-border-subtle" />
              <Label htmlFor="is_active" className="text-neutral-400 text-xs">Active</Label>
            </div>
            {error && <p className="text-xs text-status-offline">{error}</p>}
            <DialogFooter>
              <Button type="submit" size="sm" disabled={updateMutation.isPending} className="bg-aw-accent hover:bg-aw-accent-muted text-white">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={!!roleUser} onOpenChange={(open) => !open && setRoleUser(null)}>
        <DialogContent className="bg-surface-1 border-border-subtle sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Change Role</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-400">
            Changing role for <span className="text-white font-medium">{roleUser?.first_name} {roleUser?.last_name}</span>
          </p>
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className="w-full bg-surface-2 border border-border-subtle rounded px-2 py-1.5 text-sm text-neutral-300 focus:outline-none focus:ring-1 focus:ring-aw-accent">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {error && <p className="text-xs text-status-offline">{error}</p>}
          <DialogFooter>
            <Button size="sm" onClick={() => roleUser && roleMutation.mutate({ id: roleUser.id, role: newRole })} disabled={roleMutation.isPending} className="bg-aw-accent hover:bg-aw-accent-muted text-white">
              {roleMutation.isPending ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <DialogContent className="bg-surface-1 border-border-subtle sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-400">
            Are you sure you want to delete <span className="text-white font-medium">{deleteUser?.first_name} {deleteUser?.last_name}</span>? This action cannot be undone.
          </p>
          {error && <p className="text-xs text-status-offline">{error}</p>}
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
