import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Banknote,
  Bell,
  CandlestickChart,
  CreditCard,
  Home,
  LayoutGrid,
  LifeBuoy,
  Repeat,
  Settings,
  Shield,
  Users,
  Wallet,
} from "lucide-react";

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
      { label: "Cards", href: "/cards", icon: CreditCard },
    ],
  },
  {
    label: "Crypto",
    items: [
      { label: "Markets", href: "/markets", icon: CandlestickChart },
      { label: "Trade", href: "/trade", icon: CandlestickChart },
      { label: "Convert", href: "/convert", icon: Repeat },
      { label: "Wallets", href: "/wallets", icon: Wallet },
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

/** Mobile bottom navigation (design memory: Home, Markets, Transfer, Wallets, More). */
export const MOBILE_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Markets", href: "/markets", icon: CandlestickChart },
  { label: "Transfer", href: "/transfers", icon: ArrowLeftRight },
  { label: "Wallets", href: "/wallets", icon: Wallet },
  { label: "More", href: "/profile", icon: Settings },
];
