"use client";

import { useEffect, useRef, useState } from "react";
import type { PCHealthSnapshot } from "@/lib/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/health";

export function useHealthStream() {
  const [snapshots, setSnapshots] = useState<Map<string, PCHealthSnapshot>>(new Map());
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "snapshot") {
          const map = new Map<string, PCHealthSnapshot>();
          for (const s of msg.data) {
            map.set(s.pc_id, s);
          }
          setSnapshots(map);
        } else if (msg.type === "status_change") {
          setSnapshots((prev) => {
            const next = new Map(prev);
            next.set(msg.data.pc_id, msg.data);
            return next;
          });
        }
      };
    }

    connect();
    return () => wsRef.current?.close();
  }, []);

  return { snapshots: Array.from(snapshots.values()), connected };
}
