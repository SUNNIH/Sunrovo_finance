/**
 * Stop-Loss Order Monitoring Service
 * 
 * Lightweight background service for localhost development that:
 * - Runs alongside the Next.js dev server
 * - Checks stop-loss orders every 10 seconds
 * - Prevents overlapping runs
 * - Works independently of browser/user sessions
 */

import { checkAndTriggerStopLossOrders } from "@/features/crypto/stop-loss-monitor";
import { checkAndCloseDirectionalPositions } from "@/features/directional/position-monitor";

let monitorInterval: NodeJS.Timeout | null = null;
let isRunning = false;

export function startStopLossMonitor() {
  if (monitorInterval) {
    console.log("[Stop-Loss Monitor] Already running");
    return;
  }

  console.log("[Stop-Loss Monitor] Starting automatic monitoring...");

  // Initial check after 5 seconds (allow server to initialize)
  setTimeout(() => {
    checkOrders();
  }, 5000);

  // Then check every 10 seconds
  monitorInterval = setInterval(() => {
    checkOrders();
  }, 10000);
}

export function stopStopLossMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("[Stop-Loss Monitor] Stopped");
  }
}

async function checkOrders() {
  if (isRunning) {
    console.log("[Stop-Loss Monitor] Previous check still running, skipping...");
    return;
  }

  isRunning = true;

  try {
    // Keep the spot monitor independent: an outage in one must not starve the other.
    try {
      const result = await checkAndTriggerStopLossOrders();
      if (result.checked > 0) {
        console.log(`[Stop-Loss Monitor] Checked ${result.checked}: ${result.triggered} triggered, ${result.failed} failed`);
      }
      if (result.failed > 0) console.warn(`[Stop-Loss Monitor] ${result.failed} failed`);
    } catch (error) {
      console.error("[Stop-Loss Monitor] Spot scan failed:", error);
    }

    try {
      const result = await checkAndCloseDirectionalPositions();
      if (result.triggered > 0 || result.failed > 0) {
        console.log(`[Directional Monitor] checked=${result.checked} closed=${result.triggered} failed=${result.failed} stale=${result.skipped}`);
      }
    } catch (error) {
      console.error("[Directional Monitor] Position scan failed:", error);
    }
  } finally {
    isRunning = false;
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  stopStopLossMonitor();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopStopLossMonitor();
  process.exit(0);
});
