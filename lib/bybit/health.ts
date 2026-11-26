/**
 * Bybit Provider Health Monitoring
 * 
 * Tracks Bybit API availability, latency, and error rates.
 * Used to determine when to use cached data or show unavailability warnings.
 */

import type { MarketDataHealth, MarketDataStatus } from "@/lib/market/types";
import {
  PROVIDER_ERROR_THRESHOLD,
  STALE_DATA_THRESHOLD_SEC,
} from "./config";

class ProviderHealthTracker {
  private consecutiveErrors = 0;
  private lastSuccessfulUpdate: Date | null = null;
  private lastErrorMessage: string | null = null;
  private totalRequests = 0;
  private successfulRequests = 0;
  private latencies: number[] = []; // last 100 latencies in ms

  /**
   * Record a successful request.
   */
  recordSuccess(latencyMs: number): void {
    this.consecutiveErrors = 0;
    this.lastSuccessfulUpdate = new Date();
    this.totalRequests++;
    this.successfulRequests++;

    this.latencies.push(latencyMs);
    if (this.latencies.length > 100) {
      this.latencies.shift(); // Keep only last 100
    }
  }

  /**
   * Record a failed request.
   */
  recordFailure(errorMessage: string): void {
    this.consecutiveErrors++;
    this.lastErrorMessage = errorMessage;
    this.totalRequests++;
  }

  /**
   * Get current health status.
   */
  getHealth(): MarketDataHealth {
    const status = this.determineStatus();

    return {
      status,
      lastSuccessfulUpdate: this.lastSuccessfulUpdate,
      consecutiveErrors: this.consecutiveErrors,
      message: this.getStatusMessage(status),
    };
  }

  /**
   * Get detailed statistics (for monitoring/debugging).
   */
  getStats(): {
    totalRequests: number;
    successfulRequests: number;
    successRate: number;
    consecutiveErrors: number;
    averageLatencyMs: number;
    lastError: string | null;
  } {
    const averageLatencyMs =
      this.latencies.length > 0
        ? this.latencies.reduce((sum, val) => sum + val, 0) / this.latencies.length
        : 0;

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      successRate: this.totalRequests > 0
        ? this.successfulRequests / this.totalRequests
        : 0,
      consecutiveErrors: this.consecutiveErrors,
      averageLatencyMs,
      lastError: this.lastErrorMessage,
    };
  }

  /**
   * Reset all tracking data (useful for testing or after maintenance).
   */
  reset(): void {
    this.consecutiveErrors = 0;
    this.lastSuccessfulUpdate = null;
    this.lastErrorMessage = null;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.latencies = [];
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private determineStatus(): MarketDataStatus {
    // Too many consecutive errors → unavailable
    if (this.consecutiveErrors >= PROVIDER_ERROR_THRESHOLD) {
      return "unavailable";
    }

    // No successful update yet → unavailable
    if (!this.lastSuccessfulUpdate) {
      return "unavailable";
    }

    // Check if data is stale
    const now = new Date();
    const secondsSinceUpdate =
      (now.getTime() - this.lastSuccessfulUpdate.getTime()) / 1000;

    if (secondsSinceUpdate > STALE_DATA_THRESHOLD_SEC) {
      return "stale";
    }

    return "live";
  }

  private getStatusMessage(status: MarketDataStatus): string | undefined {
    switch (status) {
      case "unavailable":
        if (this.consecutiveErrors >= PROVIDER_ERROR_THRESHOLD) {
          return `Market data unavailable. ${this.consecutiveErrors} consecutive errors.`;
        }
        return "Market data unavailable.";

      case "stale":
        if (this.lastSuccessfulUpdate) {
          const secondsAgo = Math.floor(
            (Date.now() - this.lastSuccessfulUpdate.getTime()) / 1000
          );
          return `Market data is stale (last updated ${secondsAgo}s ago).`;
        }
        return "Market data is stale.";

      case "live":
        return undefined;
    }
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────

const healthTracker = new ProviderHealthTracker();

/**
 * Record a successful Bybit API request.
 */
export function recordProviderSuccess(latencyMs: number): void {
  healthTracker.recordSuccess(latencyMs);
}

/**
 * Record a failed Bybit API request.
 */
export function recordProviderFailure(errorMessage: string): void {
  healthTracker.recordFailure(errorMessage);
}

/**
 * Get current provider health status.
 */
export function getProviderHealth(): MarketDataHealth {
  return healthTracker.getHealth();
}

/**
 * Get detailed provider statistics.
 */
export function getProviderStats(): {
  totalRequests: number;
  successfulRequests: number;
  successRate: number;
  consecutiveErrors: number;
  averageLatencyMs: number;
  lastError: string | null;
} {
  return healthTracker.getStats();
}

/**
 * Reset provider health tracking.
 */
export function resetProviderHealth(): void {
  healthTracker.reset();
}
