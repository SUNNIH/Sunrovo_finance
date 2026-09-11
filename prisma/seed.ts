import { PrismaClient, AssetType, LedgerAccountType } from "@prisma/client";
import {
  demoFundingPoolName,
  externalSettlementPoolName,
  feeRevenuePoolName,
} from "../lib/ledger/platform-accounts";

const prisma = new PrismaClient();

// Reference assets supported across the MVP (design/product-scope memory:
// initial pairs BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, plus the fictional
// PLT demo token, and the fiat currencies used by demo accounts).
const ASSETS: Array<{ symbol: string; name: string; type: AssetType; precision: number }> = [
  { symbol: "USD", name: "US Dollar", type: AssetType.FIAT, precision: 2 },
  { symbol: "NGN", name: "Nigerian Naira", type: AssetType.FIAT, precision: 2 },
  { symbol: "EUR", name: "Euro", type: AssetType.FIAT, precision: 2 },
  { symbol: "GBP", name: "British Pound", type: AssetType.FIAT, precision: 2 },
  { symbol: "USDT", name: "Tether USD", type: AssetType.CRYPTO, precision: 6 },
  { symbol: "BTC", name: "Bitcoin", type: AssetType.CRYPTO, precision: 8 },
  { symbol: "ETH", name: "Ethereum", type: AssetType.CRYPTO, precision: 8 },
  { symbol: "SOL", name: "Solana", type: AssetType.CRYPTO, precision: 6 },
  { symbol: "XRP", name: "XRP", type: AssetType.CRYPTO, precision: 6 },
  {
    symbol: "PLT",
    name: "PLT Demo Token (fictional, not a tradable security)",
    type: AssetType.CRYPTO,
    precision: 4,
  },
];

async function main() {
  for (const asset of ASSETS) {
    await prisma.asset.upsert({
      where: { symbol: asset.symbol },
      update: { name: asset.name, type: asset.type, precision: asset.precision },
      create: asset,
    });
  }

  await prisma.apiConnection.upsert({
    where: { provider: "bybit" },
    update: {},
    create: {
      provider: "bybit",
      mode: "public",
      status: "unknown",
      metadata: { scope: "spot-market-data-only" },
    },
  });

  await prisma.platformSetting.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });

  async function ensurePlatformLedgerAccount(type: LedgerAccountType, assetSymbol: string, name: string) {
    const existing = await prisma.ledgerAccount.findFirst({
      where: { type, assetSymbol, name, bankAccountId: null, cryptoWalletId: null },
    });
    if (!existing) {
      await prisma.ledgerAccount.create({ data: { type, assetSymbol, name } });
    }
  }

  // Phase 2: a platform-owned "Demo Funding Pool" equity account per
  // asset, balanced against every new user's seeded starting balance
  // (see features/authentication/provision-accounts.ts).
  for (const asset of ASSETS) {
    await ensurePlatformLedgerAccount(LedgerAccountType.EQUITY, asset.symbol, demoFundingPoolName(asset.symbol));
  }

  // Phase 3: fiat-only platform accounts for simulated external-bank
  // transfers (funds "leave" FHT) and transfer fee revenue.
  const fiatAssets = ASSETS.filter((asset) => asset.type === AssetType.FIAT);
  for (const asset of fiatAssets) {
    await ensurePlatformLedgerAccount(
      LedgerAccountType.EQUITY,
      asset.symbol,
      externalSettlementPoolName(asset.symbol)
    );
    await ensurePlatformLedgerAccount(LedgerAccountType.REVENUE, asset.symbol, feeRevenuePoolName(asset.symbol));
  }

  console.log(
    `Seeded ${ASSETS.length} assets, 1 provider connection record, ${ASSETS.length} demo funding pools, and ${fiatAssets.length * 2} Phase 3 transfer pools.`
  );
  console.log("User, account and demo-balance seeding now happens per-user at registration/onboarding (Phase 2).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
