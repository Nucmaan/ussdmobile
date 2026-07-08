'use client';

import { useEffect, useRef, useState } from 'react';
import { WS_URL, getToken } from './api';

export interface LiveEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * Subscribe to the backend admin WebSocket for live device/transaction events.
 * Auto-reconnects with backoff. Returns the latest event and connection state.
 */
export function useLiveFeed(onEvent?: (e: LiveEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const token = getToken();
      if (!token) return;
      ws = new WebSocket(`${WS_URL}/admin?token=${token}`);

      ws.onopen = () => {
        retry = 0;
        setConnected(true);
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as LiveEvent;
          setLastEvent(data);
          onEventRef.current?.(data);
        } catch {
          /* ignore malformed */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (closed) return;
        retry += 1;
        const delay = Math.min(1000 * 2 ** retry, 15000);
        timer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, []);

  return { connected, lastEvent };
}
