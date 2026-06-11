"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import { STATUS_CONFIG, formatRelativeTime } from "@/lib/utils";
import type { PC, PCStatus } from "@/lib/types";

interface PCForm {
  name: string;
  ip_address: string;
  location: string;
  is_monitored: boolean;
}

const EMPTY_FORM: PCForm = { name: "", ip_address: "", location: "", is_monitored: true };

export default function PCsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingPC, setEditingPC] = useState<PC | null>(null);
  const [deletePC, setDeletePC] = useState<PC | null>(null);
  const [form, setForm] = useState<PCForm>(EMPTY_FORM);
  const [error, setError] = useState("");

  const { data: pcs = [], isLoading } = useQuery({
    queryKey: ["pcs"],
    queryFn: () => apiFetch<PC[]>("/api/pcs"),
  });

  const createMutation = useMutation({
    mutationFn: (body: PCForm) =>
      apiFetch<PC>("/api/pcs", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pcs"] });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<PCForm> }) =>
      apiFetch<PC>(`/api/pcs/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pcs"] });
      setEditingPC(null);
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/pcs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pcs"] });
      setDeletePC(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowCreate(true);
    setError("");
  };

  const openEdit = (pc: PC) => {
    setEditingPC(pc);
    setForm({
      name: pc.name,
      ip_address: pc.ip_address,
      location: pc.location || "",
      is_monitored: pc.is_monitored,
    });
    setError("");
  };

  const onlineCount = pcs.filter((p) => p.latest_status === "ONLINE").length;
  const monitoredCount = pcs.filter((p) => p.is_monitored).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">
          PC Management
          <span className="ml-2 text-sm text-neutral-500">
            {pcs.length} PCs ({onlineCount} online, {monitoredCount} monitored)
          </span>
        </h2>
        <Button size="sm" className="bg-aw-accent hover:bg-aw-accent-muted text-white" onClick={openCreate}>
          <Plus className="size-3.5 mr-1" /> Add PC
        </Button>
      </div>

      <div className="bg-surface-1 rounded-lg border border-border-subtle">
        {isLoading ? (
          <p className="text-neutral-600 text-sm py-8 text-center">Loading...</p>
        ) : pcs.length === 0 ? (
          <p className="text-neutral-600 text-sm py-8 text-center">No PCs configured.</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {pcs.map((pc) => {
              const statusConfig = STATUS_CONFIG[(pc.latest_status || "UNKNOWN") as PCStatus];
              return (
                <div key={pc.id} className="flex items-center justify-between p-3 hover:bg-surface-2/50 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${statusConfig.color.replace("text-", "bg-")}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium">{pc.name}</span>
                        <span className="font-mono text-xs text-neutral-500">{pc.ip_address}</span>
                        {!pc.is_monitored && (
                          <span className="text-2xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">PAUSED</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {pc.location && <span className="text-2xs text-neutral-600">{pc.location}</span>}
                        <span className={`text-2xs ${statusConfig.color}`}>{statusConfig.label}</span>
                        {pc.latest_ping_ms != null && (
                          <span className="text-2xs text-neutral-700 font-mono">{pc.latest_ping_ms.toFixed(0)}ms</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon-xs" variant="ghost" className="text-neutral-500 hover:text-white" onClick={() => openEdit(pc)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon-xs" variant="ghost" className="text-neutral-500 hover:text-status-offline" onClick={() => setDeletePC(pc)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create PC Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        <DialogContent className="bg-surface-1 border-border-subtle sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Add PC</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-3">
            <div>
              <Label className="text-neutral-400 text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. PC-LAB-01" className="bg-surface-2 border-border-subtle text-white text-sm h-8 font-mono" />
            </div>
            <div>
              <Label className="text-neutral-400 text-xs">IP Address</Label>
              <Input value={form.ip_address} onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))} required placeholder="e.g. 192.168.72.101" className="bg-surface-2 border-border-subtle text-white text-sm h-8 font-mono" />
            </div>
            <div>
              <Label className="text-neutral-400 text-xs">Location (optional)</Label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Lab Room 2" className="bg-surface-2 border-border-subtle text-white text-sm h-8" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_monitored" checked={form.is_monitored} onChange={(e) => setForm((f) => ({ ...f, is_monitored: e.target.checked }))} className="rounded border-border-subtle" />
              <Label htmlFor="is_monitored" className="text-neutral-400 text-xs">Enable health monitoring</Label>
            </div>
            {error && <p className="text-xs text-status-offline">{error}</p>}
            <DialogFooter>
              <Button type="submit" size="sm" disabled={createMutation.isPending} className="bg-aw-accent hover:bg-aw-accent-muted text-white">
                {createMutation.isPending ? "Adding..." : "Add PC"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit PC Dialog */}
      <Dialog open={!!editingPC} onOpenChange={(open) => !open && setEditingPC(null)}>
        <DialogContent className="bg-surface-1 border-border-subtle sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Edit PC</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (editingPC) updateMutation.mutate({ id: editingPC.id, body: form }); }} className="space-y-3">
            <div>
              <Label className="text-neutral-400 text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="bg-surface-2 border-border-subtle text-white text-sm h-8 font-mono" />
            </div>
            <div>
              <Label className="text-neutral-400 text-xs">IP Address</Label>
              <Input value={form.ip_address} onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))} className="bg-surface-2 border-border-subtle text-white text-sm h-8 font-mono" />
            </div>
            <div>
              <Label className="text-neutral-400 text-xs">Location</Label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="bg-surface-2 border-border-subtle text-white text-sm h-8" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="edit_monitored" checked={form.is_monitored} onChange={(e) => setForm((f) => ({ ...f, is_monitored: e.target.checked }))} className="rounded border-border-subtle" />
              <Label htmlFor="edit_monitored" className="text-neutral-400 text-xs">Enable health monitoring</Label>
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

      {/* Delete Confirmation */}
      <Dialog open={!!deletePC} onOpenChange={(open) => !open && setDeletePC(null)}>
        <DialogContent className="bg-surface-1 border-border-subtle sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete PC</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-400">
            Are you sure you want to delete <span className="text-white font-medium">{deletePC?.name}</span> ({deletePC?.ip_address})? All health check history will be lost.
          </p>
          {error && <p className="text-xs text-status-offline">{error}</p>}
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setDeletePC(null)}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={() => deletePC && deleteMutation.mutate(deletePC.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
