"use client";

import { useEffect, useState } from "react";
import { getSupportedPair } from "./instruments";
import { normaliseLiveKline } from "./normalisers";
import { getBybitPublicSocket } from "./websocket";
import type { Candle, KlineInterval } from "./types";

const POLL_INTERVAL_MS = 15_000;

export function useLiveCandles(symbol: string, interval: KlineInterval, initialCandles: Candle[]) {
  const [candles, setCandles] = useState(initialCandles);
  useEffect(() => { setCandles(initialCandles); }, [initialCandles]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch(`/api/markets/${symbol}/candles?interval=${interval}&limit=120`);
        const payload = await response.json();
        if (!cancelled && response.ok && Array.isArray(payload.data?.candles)) setCandles(payload.data.candles);
      } catch { /* retain the last received candles */ }
    }
    void poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [symbol, interval]);

  useEffect(() => {
    const pair = getSupportedPair(symbol);
    if (!pair || pair.isFictional) return;
    const topic = `kline.${interval}.${pair.symbol}`;
    return getBybitPublicSocket().subscribe(topic, (receivedTopic, payload) => {
      if (receivedTopic !== topic || !Array.isArray(payload)) return;
      try {
        const update = normaliseLiveKline(payload[0], pair);
        setCandles((existing) => {
          const next = [...existing];
          const index = next.findIndex((item) => item.openTime === update.openTime);
          if (index >= 0) next[index] = update; else next.push(update);
          return next.sort((a, b) => a.openTime.localeCompare(b.openTime)).slice(-120);
        });
      } catch { /* malformed provider event: polling remains the fallback */ }
    });
  }, [symbol, interval]);
  return candles;
}
