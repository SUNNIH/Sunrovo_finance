import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Banknote,
  Bell,
  CreditCard,
  Download,
  Home,
  LayoutGrid,
  LifeBuoy,
  LineChart,
  Settings,
  Shield,
  Users,
  Wallet,
  ListOrdered,
} from "lucide-react";

import { CARDS_ENABLED } from "@/lib/feature-flags";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Desktop sidebar: grouped navigation (design memory: nested nav only where useful). */
export const SIDEBAR_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutGrid }],
  },
  {
    label: "Banking",
    items: [
      { label: "Accounts", href: "/accounts", icon: Banknote },
      { label: "Transfers", href: "/transfers", icon: ArrowLeftRight },
      { label: "Beneficiaries", href: "/beneficiaries", icon: Users },
      { label: "Transactions", href: "/transactions", icon: LayoutGrid },
      ...(CARDS_ENABLED ? [{ label: "Cards", href: "/cards", icon: CreditCard }] : []),
    ],
  },
  {
    label: "Crypto",
    items: [
      { label: "Markets", href: "/markets", icon: LineChart },
      { label: "Wallets", href: "/wallets", icon: Wallet },
      { label: "Trade", href: "/trade", icon: ListOrdered },
      { label: "Deposit", href: "/deposit", icon: Download },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Security", href: "/security", icon: Shield },
      { label: "Settings", href: "/profile", icon: Settings },
    ],
  },
];

export const SUPPORT_NAV_ITEM: NavItem = {
  label: "Help & Support",
  href: "/support",
  icon: LifeBuoy,
};

/** Mobile bottom navigation (design memory: Home, Markets, Transfer, Accounts, More). */
export const MOBILE_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Markets", href: "/markets", icon: LineChart },
  { label: "Transfer", href: "/transfers", icon: ArrowLeftRight },
  { label: "Accounts", href: "/accounts", icon: Banknote },
  { label: "More", href: "/profile", icon: Settings },
];
