export class BybitUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Bybit market data is temporarily unavailable.");
    this.name = "BybitUnavailableError";
    if (cause !== undefined) this.cause = cause;
  }
}

export class UnsupportedSymbolError extends Error {
  constructor(symbol: string) {
    super(`${symbol} is not a supported trading pair.`);
    this.name = "UnsupportedSymbolError";
  }
}
