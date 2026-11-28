/**
 * Bybit V5 Public WebSocket Client
 * 
 * Manages WebSocket connections to Bybit's public spot streams.
 * Supports automatic reconnection, heartbeats, and subscription management.
 * 
 * This implementation is designed for server-side use in Next.js API routes
 * or Server Components. For client-side real-time updates, consider using
 * Server-Sent Events (SSE) or a polling strategy instead.
 */

import { WebSocket } from "ws";
import type {
  BybitWSRequest,
  BybitWSResponse,
  BybitWSTickerData,
  BybitWSKlineData,
  BybitWSOrderBookData,
  BybitWSTradeData,
} from "./types";
import { BYBIT_WS_PUBLIC_URL, WS_RECONNECT_DELAYS, WS_PING_INTERVAL_MS } from "./config";

// ─── Types ──────────────────────────────────────────────────────────────────

export type BybitWSMessage =
  | BybitWSTickerData
  | BybitWSKlineData
  | BybitWSOrderBookData
  | BybitWSTradeData;

export type BybitWSMessageHandler = (message: BybitWSMessage) => void;

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

// ─── WebSocket Manager ──────────────────────────────────────────────────────

export class BybitWebSocketManager {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = "disconnected";
  private subscriptions = new Set<string>();
  private messageHandlers = new Map<string, Set<BybitWSMessageHandler>>();
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private intentionalDisconnect = false;

  constructor(private readonly url: string = BYBIT_WS_PUBLIC_URL) {}

  /**
   * Connect to Bybit WebSocket and set up event handlers.
   */
  connect(): void {
    if (this.connectionState === "connected" || this.connectionState === "connecting") {
      return; // Already connected or connecting
    }

    this.connectionState = "connecting";
    this.intentionalDisconnect = false;

    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => this.handleOpen());
    this.ws.on("message", (data: Buffer) => this.handleMessage(data));
    this.ws.on("error", (error: Error) => this.handleError(error));
    this.ws.on("close", () => this.handleClose());
  }

  /**
   * Disconnect from WebSocket and clean up.
   */
  disconnect(): void {
    this.intentionalDisconnect = true;
    this.connectionState = "disconnected";

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to a topic (e.g., "tickers.BTCUSDT", "kline.1.BTCUSDT").
   * 
   * @param topic - WebSocket topic string
   * @param handler - Callback function to handle messages for this topic
   */
  subscribe(topic: string, handler: BybitWSMessageHandler): void {
    // Add handler
    if (!this.messageHandlers.has(topic)) {
      this.messageHandlers.set(topic, new Set());
    }
    this.messageHandlers.get(topic)!.add(handler);

    // Add to subscriptions set
    this.subscriptions.add(topic);

    // Send subscription message if connected
    if (this.connectionState === "connected" && this.ws) {
      this.sendSubscribe([topic]);
    }
  }

  /**
   * Unsubscribe from a topic and remove handler.
   */
  unsubscribe(topic: string, handler: BybitWSMessageHandler): void {
    const handlers = this.messageHandlers.get(topic);
    if (handlers) {
      handlers.delete(handler);

      // If no more handlers for this topic, unsubscribe from server
      if (handlers.size === 0) {
        this.messageHandlers.delete(topic);
        this.subscriptions.delete(topic);

        if (this.connectionState === "connected" && this.ws) {
          this.sendUnsubscribe([topic]);
        }
      }
    }
  }

  /**
   * Get current connection state.
   */
  getState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.connectionState === "connected";
  }

  // ─── Private Event Handlers ───────────────────────────────────────────────

  private handleOpen(): void {
    this.connectionState = "connected";
    this.reconnectAttempt = 0;

    // Resubscribe to all topics
    if (this.subscriptions.size > 0) {
      this.sendSubscribe(Array.from(this.subscriptions));
    }

    // Start ping interval
    this.startPing();
  }

  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as
        | BybitWSResponse
        | BybitWSMessage
        | { op: string };

      // Handle subscription responses
      if ("op" in message && message.op === "subscribe") {
        const response = message as BybitWSResponse;
        if (!response.success) {
          console.error("[Bybit WS] Subscription failed:", response.ret_msg);
        }
        return;
      }

      // Handle pong responses
      if ("op" in message && message.op === "pong") {
        return;
      }

      // Handle data messages
      const dataMessage = message as BybitWSMessage;
      if ("topic" in dataMessage) {
        this.routeMessage(dataMessage);
      }
    } catch (error) {
      console.error("[Bybit WS] Failed to parse message:", error);
    }
  }

  private handleError(error: Error): void {
    console.error("[Bybit WS] Error:", error.message);
  }

  private handleClose(): void {
    this.connectionState = "disconnected";

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Attempt reconnection if not intentionally disconnected
    if (!this.intentionalDisconnect) {
      this.scheduleReconnect();
    }
  }

  // ─── Connection Management ──────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.connectionState = "reconnecting";

    const delay =
      WS_RECONNECT_DELAYS[
        Math.min(this.reconnectAttempt, WS_RECONNECT_DELAYS.length - 1)
      ] ?? 30000;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempt++;
      this.connect();
    }, delay);
  }

  private startPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.ws && this.connectionState === "connected") {
        this.send({ op: "ping" });
      }
    }, WS_PING_INTERVAL_MS);
  }

  // ─── Message Routing ────────────────────────────────────────────────────────

  private routeMessage(message: BybitWSMessage): void {
    const topic = message.topic;
    const handlers = this.messageHandlers.get(topic);

    if (handlers && handlers.size > 0) {
      for (const handler of handlers) {
        try {
          handler(message);
        } catch (error) {
          console.error(`[Bybit WS] Handler error for topic ${topic}:`, error);
        }
      }
    }
  }

  // ─── Send Methods ───────────────────────────────────────────────────────────

  private send(message: BybitWSRequest): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private sendSubscribe(topics: string[]): void {
    this.send({
      op: "subscribe",
      args: topics,
    });
  }

  private sendUnsubscribe(topics: string[]): void {
    this.send({
      op: "unsubscribe",
      args: topics,
    });
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────

let managerInstance: BybitWebSocketManager | null = null;

/**
 * Get the global WebSocket manager instance.
 * Creates a new instance if one doesn't exist.
 */
export function getWebSocketManager(): BybitWebSocketManager {
  if (!managerInstance) {
    managerInstance = new BybitWebSocketManager();
  }
  return managerInstance;
}

/**
 * Cleanup function to disconnect and destroy the WebSocket manager.
 * Useful for graceful server shutdown or testing.
 */
export function destroyWebSocketManager(): void {
  if (managerInstance) {
    managerInstance.disconnect();
    managerInstance = null;
  }
}
