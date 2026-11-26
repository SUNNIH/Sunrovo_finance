/**
 * Next.js Instrumentation Hook
 * 
 * Runs once when the Node.js runtime initializes.
 * Used to start background services like Stop-Loss monitoring.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Only import and start in Node.js runtime (not Edge)
    const { startStopLossMonitor } = await import("./lib/stop-loss/monitor-service");
    startStopLossMonitor();
  }
}
