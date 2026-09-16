import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  ChevronDown,
  Info,
  Mail,
  Shield,
  User,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { HelpSearchFilter } from "./help-search-filter";

export const metadata: Metadata = { title: "Help & Support" };

export default async function SupportPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex flex-col gap-8 max-w-5xl animate-fade-in-up">
      {/* ── PAGE HEADER ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-page-title-mobile font-semibold tracking-tight text-text-primary sm:text-page-title">
          Help &amp; Support
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Find answers to common questions about your FISE Holdings Trust Bank account, transactions, and security.
        </p>
      </div>

      {/* ── SEARCH & FILTER (Client Component) ───────────────────────────────*/}
      <HelpSearchFilter />

      {/* ── SECURITY ALERT BOX ───────────────────────────────────────────────*/}
      <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 shadow-sm">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" aria-hidden="true" />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Suspicious Activity or Unauthorized Access?
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              If you suspect unauthorized access to your account, immediately change your password, review your{" "}
              <Link href="/security" className="underline font-medium hover:text-amber-950 dark:hover:text-amber-100">
                Security Settings
              </Link>
              , revoke unrecognized sessions, and verify your transaction history. Enable two-factor authentication for added protection.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── QUICK LINKS ──────────────────────────────────────────────────────*/}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          Quick Links
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/security">
            <Button variant="outline" className="w-full h-auto flex-col gap-2 py-4 text-xs" size="md">
              <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
              <span>Security Settings</span>
            </Button>
          </Link>
          <Link href="/profile">
            <Button variant="outline" className="w-full h-auto flex-col gap-2 py-4 text-xs" size="md">
              <User className="h-5 w-5 text-primary" aria-hidden="true" />
              <span>Profile</span>
            </Button>
          </Link>
          <Link href="/accounts">
            <Button variant="outline" className="w-full h-auto flex-col gap-2 py-4 text-xs" size="md">
              <Banknote className="h-5 w-5 text-primary" aria-hidden="true" />
              <span>Accounts</span>
            </Button>
          </Link>
          <Link href="/wallets">
            <Button variant="outline" className="w-full h-auto flex-col gap-2 py-4 text-xs" size="md">
              <Wallet className="h-5 w-5 text-primary" aria-hidden="true" />
              <span>Wallets</span>
            </Button>
          </Link>
        </div>
      </section>

      {/* ── FAQ SECTIONS ─────────────────────────────────────────────────────*/}

      {/* Accounts */}
      <section data-category="accounts">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Banknote className="h-4 w-4" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-text-primary">Accounts</h2>
        </div>
        <div className="flex flex-col gap-3">
          <FaqItem
            question="How do I view my account balances?"
            answer="Navigate to the Accounts page from the sidebar. All your bank accounts are listed with current balances, account types, and currency. Your primary account is highlighted."
          />
          <FaqItem
            question="Can I have multiple accounts?"
            answer="Yes. During onboarding, a primary account is created. Additional accounts may be available depending on your account classification and currency preferences."
          />
          <FaqItem
            question="What is the difference between available and locked balance?"
            answer="Available balance is immediately usable for transactions. Locked balance represents funds reserved for pending withdrawals or other in-flight operations."
          />
          <FaqItem
            question="How do I update my preferred currency?"
            answer="Your base currency is set during onboarding and displayed in your Profile. Contact support to request currency preference changes."
          />
        </div>
      </section>

      {/* Transfers */}
      <section data-category="transfers">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-text-primary">Transfers</h2>
        </div>
        <div className="flex flex-col gap-3">
          <FaqItem
            question="How do I transfer funds between my own accounts?"
            answer="Go to Transfers, select 'Internal Transfer', choose your source and destination accounts, enter the amount, and confirm with your transaction PIN if enabled."
          />
          <FaqItem
            question="How do I send money to another FHT user?"
            answer="Use the 'FHT Transfer' option. Enter the recipient's account number or select a saved beneficiary, enter the amount, and confirm. Transfers are processed immediately."
          />
          <FaqItem
            question="Are there transfer limits?"
            answer="Transfer limits may apply based on your account type, verification status, and security settings. Review your account details or security settings for current limits."
          />
          <FaqItem
            question="What is a beneficiary?"
            answer="A beneficiary is a saved recipient for faster transfers. Manage beneficiaries from the Beneficiaries page in the sidebar."
          />
        </div>
      </section>

      {/* Deposits & Withdrawals */}
      <section data-category="deposits-withdrawals">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Banknote className="h-4 w-4" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-text-primary">Deposits &amp; Withdrawals</h2>
        </div>
        <div className="flex flex-col gap-3">
          <FaqItem
            question="How do I deposit funds?"
            answer="Go to the Deposit page, select your account, choose deposit method (fiat wire or crypto deposit), enter the amount, and follow on-screen instructions. Crypto deposits require you to send funds to the displayed address."
          />
          <FaqItem
            question="How long do deposits take?"
            answer="Fiat deposits typically process within 1-3 business days. Crypto deposits are credited after required network confirmations, which vary by asset."
          />
          <FaqItem
            question="How do I withdraw funds?"
            answer="Navigate to Withdraw, select your bank account, enter the destination bank account details, amount, and confirm with your transaction PIN. Withdrawal allowlist may apply if enabled in Security Settings. All withdrawals require administrator review before completion."
          />
          <FaqItem
            question="What is the withdrawal allowlist?"
            answer="The withdrawal allowlist is a security feature that restricts withdrawals to pre-approved destinations only. Enable it in Security Settings to protect your funds from unauthorized withdrawals."
          />
          <FaqItem
            question="Are there withdrawal fees?"
            answer="Yes. Withdrawal fees vary by asset and network. The fee is displayed before you confirm your withdrawal and deducted from your account."
          />
        </div>
      </section>

      {/* Wallets & Digital Assets */}
      <section data-category="wallets">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Wallet className="h-4 w-4" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-text-primary">Wallets &amp; Digital Assets</h2>
        </div>
        <div className="flex flex-col gap-3">
          <FaqItem
            question="Where can I view my crypto holdings?"
            answer="Visit the Wallets page to see all your digital asset balances, including available and locked amounts. Detailed transaction history is available for each asset."
          />
          <FaqItem
            question="What cryptocurrencies does FHT support?"
            answer="FHT currently supports BTC, ETH, USDT, USDC, and other select digital assets. Available assets are displayed on the Wallets page."
          />
          <FaqItem
            question="Can I deposit crypto from an external wallet?"
            answer="Yes. Go to Deposit, select the crypto asset, and use the provided deposit address. Ensure you select the correct network to avoid loss of funds."
          />
          <FaqItem
            question="How do I send crypto to an external wallet?"
            answer="Use the Withdraw page, select your crypto wallet, enter the recipient's address and amount, and confirm. Always verify the address and network before confirming."
          />
        </div>
      </section>

      {/* Security & MFA */}
      <section data-category="security">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Shield className="h-4 w-4" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-text-primary">Security &amp; MFA</h2>
        </div>
        <div className="flex flex-col gap-3">
          <FaqItem
            question="How do I enable two-factor authentication (MFA)?"
            answer="Go to Security Settings, locate the MFA Setup card, scan the QR code with your authenticator app, enter the verification code, and submit. MFA will be required for all future logins."
          />
          <FaqItem
            question="What should I do if I lose access to my MFA device?"
            answer="Contact FISE Holdings Trust Bank support immediately. You will be required to verify your identity before MFA can be reset or replaced."
          />
          <FaqItem
            question="What is a transaction PIN?"
            answer="A transaction PIN is a separate 6-digit code required to authorize financial operations like transfers and withdrawals. Set it up in Security Settings."
          />
          <FaqItem
            question="How do I change my password?"
            answer="Visit Security Settings and locate the Change Password card. Enter your current password, your new password twice, and submit. You will remain logged in after changing your password."
          />
          <FaqItem
            question="What are trusted devices?"
            answer="Trusted devices are recognized devices you've logged in from. You can view and revoke trusted devices from the Security Settings page to improve account security."
          />
          <FaqItem
            question="How do I review my login history?"
            answer="Your recent login attempts are displayed in the Security Settings page under Login History. Review this regularly for unauthorized access attempts."
          />
        </div>
      </section>

      {/* Profile & Settings */}
      <section data-category="profile">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <User className="h-4 w-4" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-text-primary">Profile &amp; Settings</h2>
        </div>
        <div className="flex flex-col gap-3">
          <FaqItem
            question="How do I update my personal information?"
            answer="Your legal identity details (name, date of birth, country) are verified during onboarding and cannot be changed directly. To request updates or submit corrected KYC documents, contact compliance support."
          />
          <FaqItem
            question="Can I change my email address?"
            answer="Your email is your primary login credential and cannot be changed directly. Contact support if you need to update your registered email address."
          />
          <FaqItem
            question="How do I change my display theme?"
            answer="Go to Profile & Settings, locate the Appearance & Display Preferences card, and select Light or Dark mode. Your preference is saved automatically."
          />
          <FaqItem
            question="What is KYC verification?"
            answer="Know Your Customer (KYC) verification confirms your legal identity and is required for regulatory compliance. Your KYC status is displayed on your Profile page."
          />
        </div>
      </section>

      {/* ── CONTACT SUPPORT ──────────────────────────────────────────────────*/}
      <Card className="border-border/80 shadow-xs">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-text-primary">
                Contact Support
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary mt-0.5">
                Need additional assistance? Our support team is ready to help.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-2">
              Support Email
            </p>
            <p className="text-sm font-semibold text-text-primary font-mono">
              fiseholdings@supportplt.com
            </p>
            <p className="text-xs text-text-secondary mt-2 leading-relaxed">
              For account inquiries, technical issues, KYC updates, and general assistance.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-2">
              Compliance Inquiries
            </p>
            <p className="text-sm font-semibold text-text-primary font-mono">
              fiseholdings@supportplt.com
            </p>
            <p className="text-xs text-text-secondary mt-2 leading-relaxed">
              For identity verification updates, regulatory questions, and KYC document submissions.
            </p>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface/60 p-3 text-xs text-text-secondary">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
            <span className="leading-relaxed">
              Support channels are monitored during business hours. For urgent security concerns such as unauthorized account access, change your password immediately via Security Settings and revoke unrecognized sessions.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── FOOTER NOTE ──────────────────────────────────────────────────────*/}
      <div className="text-center text-xs text-text-tertiary pb-4">
        <p>FISE Holdings Trust Bank · Digital Banking &amp; Cryptocurrency Platform</p>
      </div>
    </div>
  );
}

// ─── FAQ Item Component ───────────────────────────────────────────────────────

interface FaqItemProps {
  question: string;
  answer: string;
}

function FaqItem({ question, answer }: FaqItemProps) {
  return (
    <details className="group rounded-lg border border-border bg-surface-elevated hover:border-border-hover transition-colors">
      <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm font-medium text-text-primary select-none">
        <span>{question}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-text-tertiary transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="px-4 pb-4 pt-1 text-sm text-text-secondary leading-relaxed">
        {answer}
      </div>
    </details>
  );
}
