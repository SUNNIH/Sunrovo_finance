/**
 * Browser-compatible Bybit WebSocket hook for real-time market data
 * 
 * Connects directly to Bybit's public spot WebSocket in the browser.
 * Supports automatic reconnection, heartbeats, and subscription management.
 */

import { useEffect, useRef, useCallback, useState } from "react";

const BYBIT_WS_URL = "wss://stream.bybit.com/v5/public/spot";
const PING_INTERVAL = 20000; // 20 seconds
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Progressive backoff

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

interface BybitTickerUpdate {
  topic: string;
  type: "snapshot" | "delta";
  ts: number;
  data: {
    symbol: string;
    lastPrice: string;
    price24hPcnt: string;
    highPrice24h: string;
    lowPrice24h: string;
    volume24h: string;
    turnover24h: string;
  };
}

interface BybitKlineUpdate {
  topic: string;
  type: "snapshot" | "delta";
  ts: number;
  data: Array<{
    start: number;
    end: number;
    open: string;
    close: string;
    high: string;
    low: string;
    volume: string;
    turnover: string;
    confirm: boolean;
  }>;
}

interface UseBybitWebSocketOptions {
  symbol: string;
  interval: string;
  onTickerUpdate?: (data: BybitTickerUpdate["data"]) => void;
  onKlineUpdate?: (data: BybitKlineUpdate["data"][0]) => void;
  enabled?: boolean;
}

// Convert internal interval to Bybit WebSocket interval format
function toBybitInterval(interval: string): string {
  const map: Record<string, string> = {
    "1m": "1",
    "3m": "3",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "2h": "120",
    "4h": "240",
    "6h": "360",
    "12h": "720",
    "1d": "D",
    "1w": "W",
    "1M": "M",
  };
  return map[interval] || "1";
}

export function useBybitWebSocket({
  symbol,
  interval,
  onTickerUpdate,
  onKlineUpdate,
  enabled = true,
}: UseBybitWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback(
    (topics: string[]) => {
      sendMessage({
        op: "subscribe",
        args: topics,
      });
    },
    [sendMessage]
  );

  const startPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = setInterval(() => {
      sendMessage({ op: "ping" });
    }, PING_INTERVAL);
  }, [sendMessage]);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        // Handle subscription confirmation
        if (message.op === "subscribe" && !message.success) {
          console.error("[Bybit WS] Subscription failed:", message.ret_msg);
          return;
        }

        // Handle pong
        if (message.op === "pong") {
          return;
        }

        // Handle ticker updates
        if (message.topic?.startsWith("tickers.") && onTickerUpdate) {
          const tickerUpdate = message as BybitTickerUpdate;
          onTickerUpdate(tickerUpdate.data);
        }

        // Handle kline updates
        if (message.topic?.startsWith("kline.") && onKlineUpdate) {
          const klineUpdate = message as BybitKlineUpdate;
          const firstCandle = klineUpdate.data?.[0];
          if (firstCandle) {
            onKlineUpdate(firstCandle);
          }
        }
      } catch (error) {
        console.error("[Bybit WS] Failed to parse message:", error);
      }
    },
    [onTickerUpdate, onKlineUpdate]
  );

  const connect = useCallback(() => {
    if (
      !enabled ||
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    setStatus("connecting");
    clearTimers();

    try {
      const ws = new WebSocket(BYBIT_WS_URL);

      ws.onopen = () => {
        setStatus("connected");
        reconnectAttemptRef.current = 0;

        // Subscribe to topics with correct Bybit interval format
        const bybitInterval = toBybitInterval(interval);
        const topics = [
          `tickers.${symbol}`,
          `kline.${bybitInterval}.${symbol}`,
        ];
        subscribe(topics);

        // Start heartbeat
        startPing();
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error("[Bybit WS] Error:", error);
      };

      ws.onclose = () => {
        setStatus("disconnected");
        clearTimers();

        // Auto-reconnect with exponential backoff
        if (enabled) {
          setStatus("reconnecting");
          const delay =
            RECONNECT_DELAYS[
              Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)
            ] || 30000;

          reconnectTimerRef.current = setTimeout(() => {
            reconnectAttemptRef.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("[Bybit WS] Connection failed:", error);
      setStatus("disconnected");
    }
  }, [enabled, symbol, interval, subscribe, startPing, handleMessage, clearTimers]);

  const disconnect = useCallback(() => {
    clearTimers();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, [clearTimers]);

  // Connect on mount and when dependencies change
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, symbol, interval]); // Reconnect when symbol or interval changes

  return {
    status,
    isConnected: status === "connected",
    reconnect: connect,
  };
}
