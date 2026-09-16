const BTC_DEPOSIT_ADDRESS = "bc1qwvc5dr0r8dg3u34llphslvrjnwq36alxx3e5pl";

export function getDemoDepositAddress(
  _userId: string,
  assetSymbol: string
): { address: string; network: string } {
  if (assetSymbol !== "BTC") {
    throw new Error(
      "Wallet transfer deposits are currently unavailable for this asset."
    );
  }

  return {
    address: BTC_DEPOSIT_ADDRESS,
    network: "Bitcoin",
  };
}
