/**
 * Bybit API Configuration
 * 
 * Public API endpoints and rate limits for Bybit V5 spot markets.
 * No private credentials required for Phase 1.
 */

// ─── Endpoints ──────────────────────────────────────────────────────────────

export const BYBIT_REST_BASE_URL =
  process.env.BYBIT_API_BASE_URL ?? "https://api.bybit.com";

export const BYBIT_WS_PUBLIC_URL =
  process.env.BYBIT_WS_PUBLIC_URL ?? "wss://stream.bybit.com/v5/public/spot";

// ─── Rate Limits ────────────────────────────────────────────────────────────

/**
 * Bybit V5 public spot API rate limits (as of November 2024):
 * - 10 requests per second per IP for most endpoints
 * - 120 requests per minute for some endpoints
 * 
 * We'll use a conservative 10 req/sec limit to avoid hitting the boundary.
 */
export const BYBIT_RATE_LIMIT_PER_SECOND = parseInt(
  process.env.BYBIT_RATE_LIMIT_PER_SEC ?? "10",
  10
);

// ─── Caching ────────────────────────────────────────────────────────────────

/**
 * Cache TTL for market data in seconds.
 * After this period, cached data is considered stale and a fresh request is made.
 */
export const MARKET_DATA_CACHE_TTL_SEC = parseInt(
  process.env.MARKET_DATA_CACHE_TTL_SEC ?? "10",
  10
);

// ─── Timeouts ───────────────────────────────────────────────────────────────

/**
 * Request timeout in milliseconds for REST calls.
 */
export const BYBIT_REQUEST_TIMEOUT_MS = parseInt(
  process.env.BYBIT_REQUEST_TIMEOUT_MS ?? "5000",
  10
);

/**
 * WebSocket reconnection delays (in ms).
 */
export const WS_RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // max 30s

/**
 * WebSocket ping interval (in ms) to keep connection alive.
 */
export const WS_PING_INTERVAL_MS = 20000; // 20 seconds

// ─── Provider Health ────────────────────────────────────────────────────────

/**
 * Number of consecutive errors before marking provider as unhealthy.
 */
export const PROVIDER_ERROR_THRESHOLD = 3;

/**
 * After this many seconds without a successful update, data is considered stale.
 */
export const STALE_DATA_THRESHOLD_SEC = 60;
