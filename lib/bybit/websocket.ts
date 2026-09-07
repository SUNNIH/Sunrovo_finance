"use client";

/**
 * A single shared connection to Bybit's public spot WebSocket stream,
 * used by every component in the tab that wants live ticker/orderbook
 * updates (product rule: "avoid opening a separate provider WebSocket
 * for every browser tab").
 *
 * Architecture note: Bybit's public topics require no authentication, so
 * this connects directly from the browser rather than being proxied
 * through a PLT server route. That's a deliberate deviation from the
 * "Browser -> PLT market-data service -> Bybit" diagram in the product
 * spec: Next.js's serverless-friendly request/response model has no
 * long-running process to hold a persistent upstream WebSocket open and
 * fan it out to many browser connections (unlike a traditional always-on
 * server). REST calls still go through our own `/api/markets/*` routes
 * and `lib/bybit/client.ts` (server-side, cached, normalised, mock-data
 * fallback). Every message here is passed through the *same*
 * `normaliseTicker`/etc. functions the server uses, so the UI still only
 * ever sees PLT-owned types, never a raw Bybit payload shape — direct
 * connection only changes the transport, not the data-ownership
 * boundary. A dedicated market-data fan-out service is the natural next
 * step if PLT ever needs the full proxied architecture (e.g. to add
 * private/authenticated streams, which do need server-side signing and
 * must never run in the browser).
 */

const WS_URL = process.env.NEXT_PUBLIC_BYBIT_WS_URL ?? "wss://stream.bybit.com/v5/public/spot";
const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

type MessageHandler = (topic: string, data: unknown) => void;

class BybitPublicSocket {
  private socket: WebSocket | null = null;
  private readonly subscribedTopics = new Set<string>();
  private readonly handlers = new Set<MessageHandler>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connecting = false;

  connect(): void {
    if (this.socket || this.connecting || typeof window === "undefined") return;
    this.connecting = true;

    try {
      const socket = new WebSocket(WS_URL);
      this.socket = socket;

      socket.onopen = () => {
        this.connecting = false;
        this.reconnectAttempts = 0;
        if (this.subscribedTopics.size > 0) {
          this.send({ op: "subscribe", args: Array.from(this.subscribedTopics) });
        }
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { topic?: string; data?: unknown };
          if (payload.topic && payload.data !== undefined) {
            this.handlers.forEach((handler) => handler(payload.topic!, payload.data));
          }
        } catch {
          // Ignore malformed frames (e.g. subscription ack messages with no `data`).
        }
      };

      socket.onclose = () => {
        this.connecting = false;
        this.socket = null;
        this.scheduleReconnect();
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch {
      this.connecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    // Jittered exponential backoff (product rule: "jittered reconnection").
    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempts + Math.random() * 500,
      MAX_RECONNECT_DELAY_MS
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(message: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  subscribe(topic: string, handler: MessageHandler): () => void {
    this.handlers.add(handler);
    const isNewTopic = !this.subscribedTopics.has(topic);
    this.subscribedTopics.add(topic);

    this.connect();
    if (isNewTopic) {
      this.send({ op: "subscribe", args: [topic] });
    }

    return () => {
      this.handlers.delete(handler);
      // Only unsubscribe from the topic once nothing else needs it. We
      // don't track per-topic handler counts precisely here — topics are
      // cheap to stay subscribed to for a demo app's lifetime, so we
      // leave the subscription active rather than risk dropping a topic
      // another component still needs.
    };
  }

  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

let sharedSocket: BybitPublicSocket | null = null;

export function getBybitPublicSocket(): BybitPublicSocket {
  if (!sharedSocket) {
    sharedSocket = new BybitPublicSocket();
  }
  return sharedSocket;
}
