export class LedgerImbalanceError extends Error {
  constructor(assetSymbol: string, debitTotal: string, creditTotal: string) {
    super(
      `Ledger posting is not balanced for ${assetSymbol}: debits=${debitTotal} credits=${creditTotal}`
    );
    this.name = "LedgerImbalanceError";
  }
}

export class EmptyPostingError extends Error {
  constructor() {
    super("A ledger posting must contain at least two legs");
    this.name = "EmptyPostingError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor(key: string) {
    super(`Idempotency key already used with a different payload: ${key}`);
    this.name = "IdempotencyConflictError";
  }
}

export class InsufficientFundsError extends Error {
  constructor(assetSymbol: string) {
    super(`Insufficient available balance in ${assetSymbol}`);
    this.name = "InsufficientFundsError";
  }
}
