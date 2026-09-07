import Decimal from "decimal.js";

// Money must never use JavaScript floating-point arithmetic (data memory).
// Decimal.js gives us exact base-10 arithmetic; Prisma's `Decimal` type
// (NUMERIC(36,18) in Postgres) is the same family of value at the DB layer,
// so amounts round-trip losslessly between the database and this class.
Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_UP });

export class MoneyAssetMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`Cannot operate on Money of different assets: ${a} vs ${b}`);
    this.name = "MoneyAssetMismatchError";
  }
}

/**
 * An exact, asset-tagged monetary amount. Two Money instances can only be
 * combined if they share the same `assetSymbol` — this prevents an entire
 * class of bugs (e.g. accidentally adding a USD amount to a BTC amount).
 */
export class Money {
  private readonly decimal: Decimal;
  public readonly assetSymbol: string;

  private constructor(decimal: Decimal, assetSymbol: string) {
    this.decimal = decimal;
    this.assetSymbol = assetSymbol;
  }

  static fromString(value: string, assetSymbol: string): Money {
    return new Money(new Decimal(value), assetSymbol);
  }

  /** Accepts Prisma.Decimal, Decimal, number-as-string, or string. */
  static fromDecimalLike(value: Decimal.Value, assetSymbol: string): Money {
    return new Money(new Decimal(value), assetSymbol);
  }

  static zero(assetSymbol: string): Money {
    return new Money(new Decimal(0), assetSymbol);
  }

  private assertSameAsset(other: Money): void {
    if (other.assetSymbol !== this.assetSymbol) {
      throw new MoneyAssetMismatchError(this.assetSymbol, other.assetSymbol);
    }
  }

  add(other: Money): Money {
    this.assertSameAsset(other);
    return new Money(this.decimal.add(other.decimal), this.assetSymbol);
  }

  subtract(other: Money): Money {
    this.assertSameAsset(other);
    return new Money(this.decimal.sub(other.decimal), this.assetSymbol);
  }

  multiply(factor: Decimal.Value): Money {
    return new Money(this.decimal.mul(factor), this.assetSymbol);
  }

  divide(divisor: Decimal.Value): Money {
    return new Money(this.decimal.div(divisor), this.assetSymbol);
  }

  isNegative(): boolean {
    return this.decimal.isNegative() && !this.decimal.isZero();
  }

  isZero(): boolean {
    return this.decimal.isZero();
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameAsset(other);
    return this.decimal.gt(other.decimal);
  }

  isLessThan(other: Money): boolean {
    this.assertSameAsset(other);
    return this.decimal.lt(other.decimal);
  }

  equals(other: Money): boolean {
    this.assertSameAsset(other);
    return this.decimal.eq(other.decimal);
  }

  /** Rounded to the asset's precision, as a plain decimal string (DB-safe). */
  toFixed(precision: number): string {
    return this.decimal.toFixed(precision, Decimal.ROUND_DOWN);
  }

  /** Full-precision decimal string, safe to store/round-trip. */
  toDecimalString(): string {
    return this.decimal.toFixed();
  }

  toDecimal(): Decimal {
    return this.decimal;
  }
}
