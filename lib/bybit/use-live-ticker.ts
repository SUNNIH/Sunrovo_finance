"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketTicker } from "./types";
import { getSupportedPair } from "./instruments";
import { normaliseTicker } from "./normalisers";
import { getBybitPublicSocket } from "./websocket";

const POLL_INTERVAL_MS = 8_000;

/**
 * Polling is the reliable baseline (always running, guarantees data
 * refreshes even if the WebSocket never connects — product rule: "Fall
 * back to periodic REST polling if WebSocket is unavailable"). The
 * WebSocket subscription is layered on top purely as a faster-update
 * bonus when it's working; if it never fires, the UI still updates
 * every `POLL_INTERVAL_MS` from polling alone.
 */
export function useLiveTicker(symbol: string, initialTicker: MarketTicker) {
  const [ticker, setTicker] = useState(initialTicker);
  const [isLive, setIsLive] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Polling baseline.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/markets/${symbol}`);
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled && payload.data?.ticker) {
          setTicker(payload.data.ticker);
        }
      } catch {
        // Silently keep the last known ticker — the UI's "isStale" flag
        // (surfaced from the server response) already communicates this.
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  // WebSocket bonus layer — real pairs only (PLT is fictional, never on Bybit).
  useEffect(() => {
    const pair = getSupportedPair(symbol);
    if (!pair || pair.isFictional) return;

    const socket = getBybitPublicSocket();
    const topic = `tickers.${pair.symbol}`;

    const unsubscribe = socket.subscribe(topic, (receivedTopic, data) => {
      if (receivedTopic !== topic || !mountedRef.current) return;
      try {
        setTicker(normaliseTicker(data, pair));
        setIsLive(true);
      } catch {
        // Malformed/unexpected WS payload shape — ignore this message
        // and keep relying on the polling baseline.
      }
    });

    return unsubscribe;
  }, [symbol]);

  return { ticker, isLive };
}
