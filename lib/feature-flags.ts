/**
 * FISE Holdings Trust Bank (FHT)
 * Centralized feature flags for frontend and customer-facing functionality.
 */
export const CARDS_ENABLED = true;
export const REGISTRATION_ENABLED = true;

/**
 * Phase 4: Cryptocurrency Spot Trading
 * 
 * Controls server-side financial mutations for simulated cryptocurrency trading.
 * When false, placeOrder and cancelOrder operations are blocked at the service layer.
 * 
 * Default: FALSE (trading disabled until explicit approval)
 * 
 * UI remains visible but orders will fail with "Trading temporarily disabled" error.
 */
export const CRYPTO_TRADING_ENABLED = true;

/**
 * Phase 5: Cryptocurrency Conversion
 * 
 * Controls server-side financial mutations for simulated cryptocurrency conversion.
 * When false, createConversionQuote and executeConversion operations are blocked at the service layer.
 * 
 * Default: FALSE (conversion disabled until explicit approval)
 * 
 * UI remains visible but conversions will fail with "Conversion temporarily disabled" error.
 */
export const CRYPTO_CONVERSION_ENABLED = true;
