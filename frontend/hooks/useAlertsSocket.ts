"use client";

/**
 * useAlertsSocket — Lightweight WebSocket hook for real-time alert delivery.
 *
 * Connects to ws://localhost:8000/alerts/ws and:
 *  - Receives new_alert events, appends to state, bumps unread counter
 *  - Sends pong in response to server ping heartbeats
 *  - Auto-reconnects with exponential backoff (1s → 2s → 4s → … capped at 30s)
 *  - Cleans up on component unmount
 */

import { useEffect, useRef, useCallback } from "react";
import { AlertItem } from "../lib/types";

const WS_BASE =
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
    /^http/,
    "ws"
  );

const WS_URL = `${WS_BASE}/alerts/ws`;

interface UseAlertsSocketOptions {
  userId?: number;
  onNewAlert: (alert: AlertItem) => void;
}

export function useAlertsSocket({ userId = 1, onNewAlert }: UseAlertsSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef<number>(1000);
  const isMountedRef = useRef(true);
  // Keep a stable callback ref to avoid triggering reconnect on every render
  const onNewAlertRef = useRef(onNewAlert);
  useEffect(() => { onNewAlertRef.current = onNewAlert; }, [onNewAlert]);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    const url = `${WS_URL}?user_id=${userId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      // Reset backoff on successful connection
      retryDelayRef.current = 1000;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "ping") {
          // Reply with pong to keep the connection alive through firewalls
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }

        if (msg.type === "new_alert" && msg.data) {
          onNewAlertRef.current(msg.data as AlertItem);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      // Error event is always followed by onclose, so we handle retry there
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (!isMountedRef.current) return;

      // Exponential backoff, capped at 30 seconds
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, 30_000);

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]);
}
