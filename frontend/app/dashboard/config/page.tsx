"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Save } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRelativeTime } from "@/lib/utils";
import type { ConfigEntry } from "@/lib/types";

export default function ConfigPage() {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [revealingKey, setRevealingKey] = useState<string | null>(null);
  const [revealPassword, setRevealPassword] = useState("");
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [filterNs, setFilterNs] = useState<string>("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["config", filterNs],
    queryFn: () => {
      const params = filterNs ? `?namespace=${filterNs}` : "";
      return apiFetch<ConfigEntry[]>(`/api/config${params}`);
    },
  });

  const namespaces = [...new Set(entries.map((e) => e.namespace))].sort();

  const updateMutation = useMutation({
    mutationFn: ({ ns, key, value }: { ns: string; key: string; value: string }) =>
      apiFetch(`/api/config/${ns}/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      setEditingKey(null);
      setEditValue("");
    },
  });

  const revealMutation = useMutation({
    mutationFn: ({ ns, key, password }: { ns: string; key: string; password: string }) =>
      apiFetch<{ value: string }>(`/api/config/${ns}/${key}/reveal`, {
        method: "POST",
        body: JSON.stringify({ password }),
      }),
    onSuccess: (data) => {
      setRevealedValue(data.value);
      setRevealPassword("");
    },
  });

  const startEdit = (entry: ConfigEntry) => {
    setEditingKey(`${entry.namespace}/${entry.key}`);
    setEditValue(entry.is_sensitive ? "" : entry.value || "");
    setRevealingKey(null);
    setRevealedValue(null);
  };

  const startReveal = (entry: ConfigEntry) => {
    setRevealingKey(`${entry.namespace}/${entry.key}`);
    setRevealPassword("");
    setRevealedValue(null);
    setEditingKey(null);
  };

  const handleSave = (entry: ConfigEntry) => {
    updateMutation.mutate({ ns: entry.namespace, key: entry.key, value: editValue });
  };

  const handleReveal = (entry: ConfigEntry) => {
    revealMutation.mutate({ ns: entry.namespace, key: entry.key, password: revealPassword });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Configuration</h2>
        <select
          value={filterNs}
          onChange={(e) => setFilterNs(e.target.value)}
          className="bg-surface-2 border border-border-subtle rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-aw-accent"
        >
          <option value="">All namespaces</option>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface-1 rounded-lg border border-border-subtle">
        {isLoading ? (
          <p className="text-neutral-600 text-sm py-8 text-center">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-neutral-600 text-sm py-8 text-center">No config entries found.</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {entries.map((entry) => {
              const fullKey = `${entry.namespace}/${entry.key}`;
              const isEditing = editingKey === fullKey;
              const isRevealing = revealingKey === fullKey;

              return (
                <div key={entry.id} className="p-3 hover:bg-surface-2/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-aw-accent">{entry.namespace}</span>
                        <span className="text-neutral-600">/</span>
                        <span className="text-sm font-mono text-white">{entry.key}</span>
                        {entry.is_sensitive && (
                          <span className="text-2xs px-1.5 py-0.5 rounded bg-status-offline-muted text-status-offline">
                            SECRET
                          </span>
                        )}
                      </div>
                      {entry.description && (
                        <p className="text-2xs text-neutral-600 mt-0.5">{entry.description}</p>
                      )}

                      {isEditing ? (
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder={entry.is_sensitive ? "Enter new value..." : ""}
                            className="bg-surface-2 border-border-subtle text-white text-xs h-7 font-mono"
                          />
                          <Button
                            size="xs"
                            onClick={() => handleSave(entry)}
                            disabled={updateMutation.isPending}
                            className="bg-aw-accent hover:bg-aw-accent-muted text-white"
                          >
                            <Save className="size-3 mr-1" /> Save
                          </Button>
                          <Button size="xs" variant="ghost" onClick={() => setEditingKey(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : isRevealing ? (
                        <div className="mt-2 space-y-2">
                          {revealedValue ? (
                            <div className="font-mono text-xs text-status-online bg-surface-2 px-2 py-1 rounded break-all">
                              {revealedValue}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Input
                                type="password"
                                value={revealPassword}
                                onChange={(e) => setRevealPassword(e.target.value)}
                                placeholder="Enter your password to reveal..."
                                className="bg-surface-2 border-border-subtle text-white text-xs h-7"
                                onKeyDown={(e) => e.key === "Enter" && handleReveal(entry)}
                              />
                              <Button
                                size="xs"
                                onClick={() => handleReveal(entry)}
                                disabled={revealMutation.isPending || !revealPassword}
                                className="bg-aw-accent hover:bg-aw-accent-muted text-white"
                              >
                                Reveal
                              </Button>
                            </div>
                          )}
                          <Button size="xs" variant="ghost" onClick={() => { setRevealingKey(null); setRevealedValue(null); }}>
                            Close
                          </Button>
                        </div>
                      ) : (
                        <div className="font-mono text-xs text-neutral-400 mt-1">
                          {entry.value || "—"}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {entry.is_sensitive && !isRevealing && (
                        <Button size="icon-xs" variant="ghost" className="text-neutral-500 hover:text-white" onClick={() => startReveal(entry)}>
                          <Eye className="size-3.5" />
                        </Button>
                      )}
                      {!isEditing && (
                        <Button size="icon-xs" variant="ghost" className="text-neutral-500 hover:text-white" onClick={() => startEdit(entry)}>
                          <Save className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="text-2xs text-neutral-700 mt-1">
                    Updated {formatRelativeTime(entry.updated_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
