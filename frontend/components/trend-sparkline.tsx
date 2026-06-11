"use client";

import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";

interface TrendSparklineProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}

export function TrendSparkline({
  data,
  color = "var(--color-aw-accent)",
  height = 60,
}: TrendSparklineProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={`gradient-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" hide />
        <Tooltip
          contentStyle={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#e5e5e5",
          }}
          labelStyle={{ color: "#a3a3a3", fontSize: "11px" }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#gradient-${color.replace(/[^a-z0-9]/gi, "")})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
