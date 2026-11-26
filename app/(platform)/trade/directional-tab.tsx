"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TradeChart } from "./trade-chart";
import { openDirectionalPositionAction, closeDirectionalPositionAction } from "./directional-actions";
import type { WalletView } from "@/features/crypto/wallets";

type PositionView = {
  id: string; symbol: string; side: "LONG" | "SHORT"; status: "OPEN" | "CLOSED";
  quantity: string; entryPrice: string; margin: string; entryFee: string;
  stopLossPrice: string | null; takeProfitPrice: string | null;
  closePrice: string | null; closeReason: string | null;
  netPnl: string | null; openedAt: string; closedAt: string | null;
};

type Props = {
  symbol: string;
  interval: string;
  candles: { openTime: string; open: string; high: string; low: string; close: string; volume: string }[];
  ticker: { lastPrice: string; status: "live" | "stale" | "unavailable" } | null;
  pricePrecision: number;
  quantityPrecision: number;
  instruments: { symbol: string; baseAsset: string; quoteAsset: string; status: string }[];
  walletData: WalletView | null;
};

function formatAmount(value: string, dp = 6) {
  try { return new Decimal(value).toDecimalPlaces(dp).toString(); } catch { return value; }
}

export function DirectionalTab(props: Props) {
  const router = useRouter();
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [quantity, setQuantity] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [positions, setPositions] = useState<PositionView[]>([]);
  const [marketTicker, setMarketTicker] = useState(props.ticker);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const submitLock = useRef(false);
  const previousAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/trade/positions?symbol=${encodeURIComponent(props.symbol)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to refresh positions (${response.status})`);
      const data = await response.json();
      setFeatureEnabled(data.tradingEnabled === true);
      if (Array.isArray(data.positions)) setPositions(data.positions.filter((p: PositionView) => p.symbol === props.symbol));
    } catch (error) {
      console.error("Directional positions refresh failed", error);
    }
  }, [props.symbol]);

  const refreshMarket = useCallback(async () => {
    try {
      const response = await fetch(`/api/trade/directional-mark?symbol=${encodeURIComponent(props.symbol)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Market status ${response.status}`);
      const data = await response.json();
      setMarketTicker(data.lastPrice ? { lastPrice: data.lastPrice, status: data.status } : null);
    } catch { setMarketTicker(null); }
  }, [props.symbol]);

  useEffect(() => {
    void refresh(); void refreshMarket();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh(); void refreshMarket();
      }
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [refresh, refreshMarket]);

  const activePositions = positions.filter((p) => p.status === "OPEN");
  const closedPositions = positions.filter((p) => p.status === "CLOSED");
  type Overlay = {
    id: string; symbol: string; type: "ENTRY_ACTIVE" | "STOP_OPEN" | "TAKE_PROFIT_OPEN" | "FILLED";
    side: "BUY" | "SELL"; price: number; time?: number;
  };
  const chartOverlays: Overlay[] = activePositions.flatMap((p) => {
    const result: Overlay[] = [];
    const side = p.side === "LONG" ? "BUY" : "SELL";
    result.push({ id: `${p.id}:entry`, symbol: p.symbol, type: "ENTRY_ACTIVE", side, price: Number(p.entryPrice) });
    if (p.stopLossPrice) result.push({ id: `${p.id}:sl`, symbol: p.symbol, type: "STOP_OPEN", side, price: Number(p.stopLossPrice) });
    if (p.takeProfitPrice) result.push({ id: `${p.id}:tp`, symbol: p.symbol, type: "TAKE_PROFIT_OPEN", side, price: Number(p.takeProfitPrice) });
    return result.filter((o) => Number.isFinite(o.price) && o.price > 0);
  });
  // Real (simulated) fill timestamps supply historical markers. The chart's
  // Previous Trades switch hides these without hiding active TP/SL levels.
  for (const p of positions) {
    const openedAt = Date.parse(p.openedAt) / 1000;
    const entryPrice = Number(p.entryPrice);
    if (Number.isFinite(openedAt) && Number.isFinite(entryPrice) && entryPrice > 0) {
      chartOverlays.push({ id: `${p.id}:fill-entry`, symbol: p.symbol, type: "FILLED",
        side: p.side === "LONG" ? "BUY" : "SELL", price: entryPrice, time: Math.floor(openedAt) });
    }
    if (p.status === "CLOSED" && p.closedAt && p.closePrice) {
      const closedAt = Date.parse(p.closedAt) / 1000;
      const price = Number(p.closePrice);
      if (Number.isFinite(closedAt) && Number.isFinite(price) && price > 0) {
        chartOverlays.push({ id: `${p.id}:fill-close`, symbol: p.symbol, type: "FILLED",
          side: p.side === "LONG" ? "SELL" : "BUY", price, time: Math.floor(closedAt) });
      }
    }
  }

  const usdt = props.walletData?.assets.find((asset) => asset.assetSymbol === "USDT");
  let marginEstimate = "—";
  try {
    if (marketTicker && marketTicker.status === "live" && quantity && new Decimal(quantity).gt(0)) {
      marginEstimate = new Decimal(quantity).times(marketTicker.lastPrice).times("1.001").toDecimalPlaces(8, Decimal.ROUND_UP).toString();
    }
  } catch { /* Leave the preview blank for partially typed input. */ }

  async function open() {
    if (submitLock.current || !featureEnabled || !marketTicker || marketTicker.status !== "live") return;
    try {
      if (!quantity || !new Decimal(quantity).isFinite() || new Decimal(quantity).lte(0)) {
        setMessage("Enter a valid positive quantity"); return;
      }
    } catch { setMessage("Enter a valid positive quantity"); return; }
    if (!props.walletData?.walletId) { setMessage("USDT spot wallet not found"); return; }
    const request = {
      walletId: props.walletData.walletId,
      symbol: props.symbol, side, quantity,
      stopLossPrice: stopLossPrice.trim() || null,
      takeProfitPrice: takeProfitPrice.trim() || null,
    };
    if (!window.confirm(`Open simulated 1x ${side} on ${props.symbol}?\nQuantity: ${quantity}\nEstimated margin + entry fee: ${marginEstimate} USDT\nSL: ${request.stopLossPrice ?? "None"}\nTP: ${request.takeProfitPrice ?? "None"}`)) return;
    submitLock.current = true;
    setLoading(true); setMessage("");
    try {
      const fingerprint = JSON.stringify(request);
      if (!previousAttempt.current || previousAttempt.current.fingerprint !== fingerprint) {
        previousAttempt.current = { fingerprint, key: crypto.randomUUID() };
      }
      const result = await openDirectionalPositionAction({ ...request, idempotencyKey: previousAttempt.current.key });
      if (!result.success) { setMessage(result.error ?? "Position could not be opened"); return; }
      previousAttempt.current = null;
      setMessage(`${side} opened at ${result.filledPrice} USDT (simulated)`);
      setQuantity(""); setStopLossPrice(""); setTakeProfitPrice("");
      await refresh(); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); }
    finally { submitLock.current = false; setLoading(false); }
  }

  async function close(id: string) {
    if (busyId || !window.confirm("Close this simulated directional position at the current market price?")) return;
    setBusyId(id); setMessage("");
    try {
      const result = await closeDirectionalPositionAction(id, `directional-manual:${id}`);
      if (!result.success) setMessage(result.error ?? "Could not close position");
      else {
        setMessage(`Position closed at ${result.filledPrice} USDT`);
        await refresh(); router.refresh();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); }
    finally { setBusyId(null); }
  }

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold">Simulated Long / Short · Isolated 1×</h2>
        <p className="text-sm text-text-tertiary">Separate from spot holdings. Uses locked USDT collateral, not borrowed coins.</p>
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor="directional-pair" className="text-sm">Market</label>
        <select id="directional-pair" className="rounded-md border bg-surface px-3 py-2" value={props.symbol}
          onChange={(e) => router.push(`/trade?tab=directional&symbol=${encodeURIComponent(e.target.value)}&interval=${props.interval}`)}>
          {props.instruments.filter((i) => i.status === "active" && i.quoteAsset === "USDT").map((i) =>
            <option key={i.symbol} value={i.symbol}>{i.baseAsset}/{i.quoteAsset}</option>)}
        </select>
      </div>
    </div>
    <Card><CardHeader><CardTitle>Price chart · {props.symbol}</CardTitle></CardHeader><CardContent>
      <TradeChart key={`${props.symbol}-${props.interval}`} symbol={props.symbol} candles={props.candles}
        currentInterval={props.interval} pricePrecision={props.pricePrecision}
        liveTicker={marketTicker} orders={chartOverlays} />
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Open a market position</CardTitle></CardHeader><CardContent>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex gap-2">
          <button type="button" className={`flex-1 rounded-md border p-3 font-semibold ${side === "LONG" ? "bg-success/10 border-success text-success" : "bg-surface"}`} onClick={() => setSide("LONG")}>BUY / LONG ↑</button>
          <button type="button" className={`flex-1 rounded-md border p-3 font-semibold ${side === "SHORT" ? "bg-danger/10 border-danger text-danger" : "bg-surface"}`} onClick={() => setSide("SHORT")}>SELL / SHORT ↓</button>
        </div>
        <div className="text-sm text-text-tertiary rounded-md border p-3">
          Market: {marketTicker?.status ?? "unavailable"} · Indicative price: {marketTicker?.lastPrice ?? "—"} USDT
          <br />Available USDT: {usdt?.available ?? "0"} · Locked USDT: {usdt?.locked ?? "0"}
        </div>
        <label className="text-sm">Quantity (base asset)
          <input className="mt-1 w-full rounded-md border bg-surface p-3" type="number" step="any" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={`e.g. ${props.quantityPrecision >= 4 ? "0.001" : "1"}`} />
        </label>
        <div className="text-sm rounded-md border p-3">Est. required collateral + entry fee: <strong>{marginEstimate} USDT</strong><br /><span className="text-text-tertiary">Execution price, fees and margin are finalized server-side.</span></div>
        <label className="text-sm">Stop Loss price (optional)
          <input className="mt-1 w-full rounded-md border bg-surface p-3" type="number" step="any" min="0" value={stopLossPrice} onChange={(e) => setStopLossPrice(e.target.value)} placeholder={side === "LONG" ? "Below entry" : "Above entry"} />
        </label>
        <label className="text-sm">Take Profit price (optional)
          <input className="mt-1 w-full rounded-md border bg-surface p-3" type="number" step="any" min="0" value={takeProfitPrice} onChange={(e) => setTakeProfitPrice(e.target.value)} placeholder={side === "LONG" ? "Above entry" : "Below entry"} />
        </label>
      </div>
      {!featureEnabled && <p className="mt-3 text-sm text-danger">New directional positions are disabled until the database and background monitor are configured.</p>}
      <p className="mt-3 text-xs text-text-tertiary">TP/SL are OCO conditions on one position. Liquidation can close a position first. Quotes can gap past triggers; losses may exhaust isolated collateral.</p>
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
      <button type="button" onClick={() => void open()} disabled={loading || !props.walletData?.walletId || !featureEnabled || marketTicker?.status !== "live"}
        className="mt-4 rounded-md bg-primary px-6 py-3 font-semibold text-white disabled:opacity-50">
        {loading ? "Submitting…" : `Open ${side} (market, 1×)`}
      </button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Open directional positions ({activePositions.length})</CardTitle></CardHeader><CardContent>
      {activePositions.length === 0 ? <p className="py-4 text-sm text-text-tertiary">No open positions for this market.</p> :
        <div className="space-y-3">{activePositions.map((p) => {
          let pnl = "—";
          try {
            if (marketTicker?.status === "live") pnl = new Decimal(marketTicker.lastPrice).minus(p.entryPrice).times(p.quantity)
              .times(p.side === "LONG" ? 1 : -1).toDecimalPlaces(8).toString();
          } catch { /* Indicative only */ }
          return <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <div><strong>{p.side}</strong> · {p.quantity} {props.symbol} <br />Entry: {p.entryPrice} · Margin: {p.margin} USDT<br />SL: {p.stopLossPrice ?? "—"} · TP: {p.takeProfitPrice ?? "—"}<br />Indicative gross P&amp;L: {pnl} USDT</div>
            <button type="button" disabled={!!busyId} onClick={() => void close(p.id)} className="rounded-md border px-4 py-2 disabled:opacity-50">{busyId === p.id ? "Closing…" : "Close at market"}</button>
          </div>;
        })}</div>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Closed positions ({closedPositions.length})</CardTitle></CardHeader><CardContent>
      {closedPositions.length === 0 ? <p className="py-4 text-sm text-text-tertiary">No closed positions for this market.</p> :
        <div className="space-y-2">{closedPositions.map((p) => <div key={p.id} className="rounded-md border p-3 text-sm">
          {p.side} · {p.quantity} · Entry {p.entryPrice} → Exit {p.closePrice} · {p.closeReason} · Net P&amp;L: {p.netPnl !== null ? formatAmount(p.netPnl, 8) : "—"} USDT
        </div>)}</div>}
    </CardContent></Card>
  </div>;
}
