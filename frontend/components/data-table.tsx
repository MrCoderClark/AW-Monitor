"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyFn: (row: T) => string;
  onRowClick?: (row: T) => void;
  sortKey?: string;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyFn,
  onRowClick,
  emptyMessage = "No data",
}: DataTableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (sortCol === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(key);
      setSortDir("desc");
    }
  };

  const sorted = sortCol
    ? [...data].sort((a, b) => {
        const col = columns.find((c) => c.key === sortCol);
        if (!col) return 0;
        const aVal = col.render(a);
        const bVal = col.render(b);
        const aStr = typeof aVal === "string" || typeof aVal === "number" ? aVal : "";
        const bStr = typeof bVal === "string" || typeof bVal === "number" ? bVal : "";
        if (aStr < bStr) return sortDir === "asc" ? -1 : 1;
        if (aStr > bStr) return sortDir === "asc" ? 1 : -1;
        return 0;
      })
    : data;

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border-subtle hover:bg-transparent">
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={cn(
                "text-xs uppercase tracking-wider text-neutral-500 cursor-pointer select-none",
                col.className
              )}
              onClick={() => handleSort(col.key)}
            >
              {col.header}
              {sortCol === col.key && (
                <span className="ml-1 text-neutral-600">{sortDir === "asc" ? "↑" : "↓"}</span>
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center text-neutral-600 py-8">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          sorted.map((row) => (
            <TableRow
              key={keyFn(row)}
              className={cn(
                "border-border-subtle hover:bg-surface-2",
                onRowClick && "cursor-pointer"
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={cn("text-sm", col.className)}>
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
