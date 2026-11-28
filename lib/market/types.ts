/**
 * Sunrovo Finance Market Data Types
 * 
 * These are the internal normalized types used throughout the application.
 * They abstract away provider-specific structures (Bybit, etc.) and ensure
 * consistent decimal precision handling.
 */

import type { Decimal } from "decimal.js";

// ─── Market Data Availability ───────────────────────────────────────────────

export type MarketDataStatus = "live" | "stale" | "unavailable";

export interface MarketDataHealth {
  status: MarketDataStatus;
  lastSuccessfulUpdate: Date | null;
  consecutiveErrors: number;
  message?: string;
}

// ─── Ticker ─────────────────────────────────────────────────────────────────

export interface MarketTicker {
  symbol: string;
  lastPrice: Decimal;
  high24h: Decimal;
  low24h: Decimal;
  priceChange24h: Decimal; // absolute change
  priceChangePercent24h: Decimal; // percentage as decimal (0.0123 = 1.23%)
  volume24h: Decimal; // base asset volume
  quoteVolume24h: Decimal; // quote asset volume
  timestamp: Date;
  status: MarketDataStatus;
}

// ─── Instrument ─────────────────────────────────────────────────────────────

export interface TradingInstrument {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: "active" | "inactive" | "prelisting";
  minOrderQuantity: Decimal;
  maxOrderQuantity: Decimal;
  minOrderValue: Decimal; // in quote asset
  maxOrderValue: Decimal;
  pricePrecision: number; // decimal places
  quantityPrecision: number; // decimal places
  tickSize: Decimal;
}

// ─── Candlestick ────────────────────────────────────────────────────────────

export type CandlestickInterval =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "12h"
  | "1d"
  | "1w"
  | "1M";

export interface Candlestick {
  symbol: string;
  interval: CandlestickInterval;
  openTime: Date;
  closeTime: Date;
  open: Decimal;
  high: Decimal;
  low: Decimal;
  close: Decimal;
  volume: Decimal; // base asset
  quoteVolume: Decimal; // quote asset (turnover)
  isFinal: boolean; // false for the current incomplete candle
}

// ─── Order Book ─────────────────────────────────────────────────────────────

export interface OrderBookLevel {
  price: Decimal;
  quantity: Decimal;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[]; // sorted descending by price
  asks: OrderBookLevel[]; // sorted ascending by price
  timestamp: Date;
  updateId?: number; // for delta updates
  status: MarketDataStatus;
}

// ─── Public Trade ───────────────────────────────────────────────────────────

export type TradeSide = "buy" | "sell";

export interface PublicTrade {
  id: string;
  symbol: string;
  price: Decimal;
  quantity: Decimal;
  quoteQuantity: Decimal; // price * quantity
  side: TradeSide;
  timestamp: Date;
  isBlockTrade: boolean;
}

// ─── Rate Limiting ──────────────────────────────────────────────────────────

export interface RateLimitConfig {
  maxRequestsPerSecond: number;
  maxRequestsPerMinute?: number;
}

export interface RateLimitState {
  availableTokens: number;
  lastRefillTime: Date;
}
