/**
 * Bybit V5 Public REST Client
 *
 * Implements HTTP calls to Bybit's V5 public spot API.
 * Handles rate limiting, timeouts, retries, and error responses.
 */

import type {
  BybitResponse,
  BybitTickerResult,
  BybitInstrumentsResult,
  BybitKlineResult,
  BybitOrderBookResult,
  BybitRecentTradesResult,
  BybitKlineInterval,
} from "./types";

import { acquireRateLimitToken } from "./rate-limiter";

import {
  BYBIT_REST_BASE_URL,
  BYBIT_REQUEST_TIMEOUT_MS,
} from "./config";

// ─── Error Types ────────────────────────────────────────────────────────────

export class BybitAPIError extends Error {
  public readonly retCode: number;
  public readonly retMsg: string;

  constructor(message: string, retCode: number, retMsg: string) {
    super(message);

    this.name = "BybitAPIError";
    this.retCode = retCode;
    this.retMsg = retMsg;
  }
}

export class BybitNetworkError extends Error {
  public errorCause?: unknown;
  public readonly status?: number;

  constructor(message: string, cause?: unknown, status?: number) {
    super(message);

    this.name = "BybitNetworkError";
    this.errorCause = cause;
    this.status = status;
  }
}

export class BybitTimeoutError extends Error {
  constructor(message: string) {
    super(message);

    this.name = "BybitTimeoutError";
  }
}

// ─── HTTP Client ────────────────────────────────────────────────────────────

/**
 * Make a GET request to Bybit V5 public API.
 *
 * Each request attempt:
 * - Acquires its own rate-limit token
 * - Uses an independent timeout
 * - Validates HTTP and Bybit response status
 *
 * Transient failures are retried once.
 */
async function get<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<BybitResponse<T>> {
  const url = new URL(path, BYBIT_REST_BASE_URL);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  // Public GET requests are safe to retry on transient failures.
  // Every attempt receives a new rate-limit token and timeout.
  return withRetry(
    async () => {
      await acquireRateLimitToken();

      const controller = new AbortController();

      const timeoutId = setTimeout(
        () => controller.abort(),
        BYBIT_REQUEST_TIMEOUT_MS
      );

      try {
        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
  const responseBody = await response.text();

  console.error("[Bybit REST] HTTP request rejected", {
    status: response.status,
    statusText: response.statusText,
    host: url.hostname,
    endpoint: url.pathname,
    region: process.env.VERCEL_REGION ?? "local-or-unknown",
    response: responseBody.slice(0, 500),
  });

  throw new BybitNetworkError(
    `HTTP ${response.status}: ${response.statusText}`,
    undefined,
    response.status
  );
}

        // Keep timeout active until JSON parsing completes.
        let data: BybitResponse<T>;

        try {
          data = (await response.json()) as BybitResponse<T>;
        } catch (error) {
          // A timeout during response-body reading
          // must be treated as a request timeout.
          if (
            controller.signal.aborted ||
            (error instanceof Error && error.name === "AbortError")
          ) {
            throw error;
          }

          throw new BybitNetworkError(
            "Invalid JSON response from Bybit API",
            error,
            response.status
          );
        }

        // Validate the response envelope.
        if (
          !data ||
          typeof data !== "object" ||
          typeof data.retCode !== "number" ||
          typeof data.retMsg !== "string" ||
          !("result" in data)
        ) {
          throw new BybitNetworkError(
            "Malformed response from Bybit API",
            undefined,
            response.status
          );
        }

        // Check Bybit-specific error codes.
        if (data.retCode !== 0) {
          throw new BybitAPIError(
            `Bybit API error: ${data.retMsg}`,
            data.retCode,
            data.retMsg
          );
        }

        return data;
      } catch (error) {
        // Preserve known errors.
        if (
          error instanceof BybitAPIError ||
          error instanceof BybitNetworkError ||
          error instanceof BybitTimeoutError
        ) {
          throw error;
        }

        // Handle request or response-body timeout.
        if (
          error instanceof Error &&
          (error.name === "AbortError" || controller.signal.aborted)
        ) {
          throw new BybitTimeoutError(
            `Request timeout after ${BYBIT_REQUEST_TIMEOUT_MS}ms`
          );
        }

        // Handle unexpected network failures.
        throw new BybitNetworkError(
          "Failed to fetch from Bybit API",
          error
        );
      } finally {
        // Clear timeout after the entire request has finished.
        clearTimeout(timeoutId);
      }
    },
    1,
    500
  );
}

// ─── Public API Endpoints ───────────────────────────────────────────────────

/**
 * Fetch ticker data for a single symbol or all symbols.
 *
 * @param symbol - Trading pair symbol (e.g., "BTCUSDT").
 * Omit to fetch all spot tickers.
 */
export async function fetchTicker(
  symbol?: string
): Promise<BybitTickerResult> {
  const params: Record<string, string> = {
    category: "spot",
  };

  if (symbol) {
    params.symbol = symbol;
  }

  const response = await get<BybitTickerResult>(
    "/v5/market/tickers",
    params
  );

  return response.result;
}

/**
 * Fetch available trading instruments.
 *
 * @param params.symbol - Filter by symbol
 * @param params.status - Filter by status
 */
export async function fetchInstruments(
  params: {
    symbol?: string;
    status?: string;
    limit?: number;
  } = {}
): Promise<BybitInstrumentsResult> {
  const queryParams: Record<string, string | number> = {
    category: "spot",
  };

  if (params.symbol) {
    queryParams.symbol = params.symbol;
  }

  if (params.status) {
    queryParams.status = params.status;
  }

  const response = await get<BybitInstrumentsResult>(
    "/v5/market/instruments-info",
    queryParams
  );

  return response.result;
}

/**
 * Fetch candlestick (OHLCV) data.
 *
 * @param symbol - Trading pair symbol
 * @param interval - Bybit candlestick interval
 * @param params.start - Start timestamp in milliseconds
 * @param params.end - End timestamp in milliseconds
 * @param params.limit - Number of candles
 */
export async function fetchKline(
  symbol: string,
  interval: BybitKlineInterval,
  params: {
    start?: number;
    end?: number;
    limit?: number;
  } = {}
): Promise<BybitKlineResult> {
  const queryParams: Record<string, string | number> = {
    category: "spot",
    symbol,
    interval,
  };

  if (params.start !== undefined) {
    queryParams.start = params.start;
  }

  if (params.end !== undefined) {
    queryParams.end = params.end;
  }

  if (params.limit !== undefined) {
    queryParams.limit = params.limit;
  }

  const response = await get<BybitKlineResult>(
    "/v5/market/kline",
    queryParams
  );

  return response.result;
}

/**
 * Fetch order-book depth data.
 *
 * @param symbol - Trading pair symbol
 * @param limit - Number of price levels to return
 */
export async function fetchOrderBook(
  symbol: string,
  limit: number = 20
): Promise<BybitOrderBookResult> {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 1000
  ) {
    throw new Error("Invalid order book depth");
  }

  // Bybit spot REST supports depth 1 or 1000.
  const apiDepth = limit === 1 ? 1 : 1000;

  const response = await get<BybitOrderBookResult>(
    "/v5/market/orderbook",
    {
      category: "spot",
      symbol,
      limit: apiDepth,
    }
  );

  const result = response.result;

  // Return only the levels required by the application.
  return {
    ...result,
    b: result.b.slice(0, limit),
    a: result.a.slice(0, limit),
  };
}

/**
 * Fetch recent public trades.
 *
 * @param symbol - Trading pair symbol
 * @param limit - Number of trades
 */
export async function fetchRecentTrades(
  symbol: string,
  limit: number = 60
): Promise<BybitRecentTradesResult> {
  const queryParams = {
    category: "spot",
    symbol,
    limit,
  };

  const response = await get<BybitRecentTradesResult>(
    "/v5/market/recent-trade",
    queryParams
  );

  return response.result;
}

// ─── Retry Wrapper ──────────────────────────────────────────────────────────

/**
 * Retry a function with exponential backoff.
 *
 * Retryable failures:
 * - Network errors without an HTTP status
 * - Request timeouts
 * - HTTP 408
 * - HTTP 500, 502, 503, 504
 *
 * Non-retryable failures:
 * - Bybit API errors
 * - HTTP 429 rate limits
 * - Other HTTP client errors
 *
 * @param fn - Async function to retry
 * @param maxRetries - Maximum additional attempts
 * @param baseDelay - Initial delay in milliseconds
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const retryable =
        error instanceof BybitTimeoutError ||
        (error instanceof BybitNetworkError &&
          (error.status === undefined ||
            error.status === 408 ||
            error.status === 500 ||
            error.status === 502 ||
            error.status === 503 ||
            error.status === 504));

      // Do not retry invalid requests, API errors,
      // rate-limit responses, or exhausted attempts.
      if (!retryable || attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff.
      const delay = baseDelay * Math.pow(2, attempt);

      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay);
      });
    }
  }
}