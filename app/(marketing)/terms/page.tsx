import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for the Sunrovo Finance software demonstration.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="TERMS OF SERVICE"
      effectiveDate="28 November 2026"
    >
      <p>
        Last Updated: 28 November 2026
      </p>

      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use
        of Sunrovo Finance (&ldquo;Sunrovo Finance,&rdquo; &ldquo;the
        platform,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo; or
        &ldquo;our&rdquo;), a web-based portfolio project demonstrating
        digital banking and simulated cryptocurrency services.
      </p>

      <p>
        By registering an account or using the platform, you agree to these
        Terms, subject to applicable law.
      </p>

      <p className="mt-3 font-semibold">
        Important: Sunrovo Finance is a live software demonstration under
        active development. It is not a licensed financial institution. All
        financial transactions and balances are simulated. Do not deposit,
        transfer or invest real funds through this platform.
      </p>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          1. Platform Services
        </h2>

        <p className="mt-2">
          Sunrovo Finance is a web-based software portfolio demonstration for
          exploring digital banking and simulated financial workflows. It is
          not a licensed bank, broker, cryptocurrency exchange, payment
          institution or financial custodian. The live website is a deployed
          demonstration, not a live financial service.
        </p>

        <p className="mt-3">
          Depending on the features currently enabled, the platform may allow
          you to explore:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            Simulated current and savings accounts and transaction records;
          </li>
          <li>
            Simulated deposits, internal transfers, external transfer requests
            and fiat withdrawal requests;
          </li>
          <li>
            Virtual cryptocurrency wallets, market data, watchlists and
            currency or asset conversions;
          </li>
          <li>
            Simulated market and limit orders, long and short positions, and
            linked stop-loss and take-profit orders where supported;
          </li>
          <li>
            Administrative review and approval of selected simulated
            transactions.
          </li>
        </ul>

        <p className="mt-3">
          All balances, credits, debits, fees, orders and transaction records
          within the demonstration represent simulated activity. They do not
          create a claim to money, cryptocurrency or other assets. Do not send
          real funds or digital assets to any account details or wallet
          addresses displayed on the platform.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          2. Eligibility and Account Opening
        </h2>

        <p className="mt-2">
          Provide accurate information necessary to create and maintain your
          demonstration account, including an email address you control. Do
          not impersonate another person or provide information you are not
          authorized to use.
        </p>

        <p className="mt-3">
          Email verification is required under these Terms before accessing
          authenticated services. You may request a new verification link if
          the original link expires or is not received. Email verification
          confirms access to an email address; it is not financial identity
          verification or regulatory KYC.
        </p>

        <p className="mt-3">
          Do not submit government identification, real bank credentials,
          payment card details or private wallet keys for the purpose of
          testing this platform. Access may be restricted to protect the
          platform or its users.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          3. Account Security
        </h2>

        <p className="mt-2">
          Keep your password, transaction PIN, multi-factor authentication
          credentials, devices and recovery information confidential. Use the
          security controls provided by the platform and do not share
          credentials or verification and password reset links.
        </p>

        <p className="mt-3">
          Report suspected unauthorized access, compromised credentials or
          unusual account activity promptly through the project contact
          channel when available.
        </p>

        <p className="mt-3">
          Access may be restricted and sessions may be revoked when security
          risks are identified. Do not attempt to bypass email verification,
          authentication, authorization or administrative controls.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          4. Deposits and Account Balances
        </h2>

        <p className="mt-2">
          Account balances are virtual balances recorded in the platform
          database and ledger. They are not deposits held by a financial
          institution and are not covered by deposit insurance. They have no
          cash or redemption value.
        </p>

        <p className="mt-3">
          Simulated incoming fiat deposit requests may remain pending until an
          administrator reviews and approves or rejects them. Approval updates
          the relevant virtual records only; it does not confirm receipt of
          actual funds.
        </p>

        <p className="mt-3">
          The platform may correct duplicate, erroneous or unauthorized
          simulated entries. Transaction histories and statements are
          demonstration records, not proof of real-world payment, ownership or
          funds.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          5. Transfers and Payments
        </h2>

        <p className="mt-2">
          The platform may support simulated transfers between accounts and
          requests representing transfers to external institutions. Internal
          transfers may be processed within the demonstration ledger, while
          external transfer requests may require administrative approval.
        </p>

        <p className="mt-3">
          Transfers may be subject to:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            Authentication and authorization requirements;
          </li>
          <li>
            Available virtual balance and transaction limits;
          </li>
          <li>
            Recipient information checks;
          </li>
          <li>
            Administrative review, simulated fees and processing rules.
          </li>
        </ul>

        <p className="mt-3">
          Review recipient details and transaction amounts before submitting a
          request. An approved or completed transfer is a change in
          demonstration records only and does not instruct a bank, payment
          network or other financial institution to move actual funds.
          Completed simulated transfers may not be cancellable through the
          interface.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          6. Withdrawals
        </h2>

        <p className="mt-2">
          Withdrawals are simulated fiat withdrawal requests. They are subject
          to available virtual balances, supported currencies, applicable
          limits and administrative review.
        </p>

        <p className="mt-3">
          The current demonstrated withdrawal policy requires a minimum of USD
          100 or its equivalent in a supported fiat currency. All withdrawal
          requests require administrator approval. Direct cryptocurrency
          withdrawals are not supported.
        </p>

        <p className="mt-3">
          A pending request may reserve or deduct a virtual balance in
          accordance with the workflow. Approval or rejection is reflected in
          the ledger, including any applicable simulated refund. No withdrawal
          results in a real payment or redemption of funds.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          7. Cryptocurrency and Digital-Asset Services
        </h2>

        <p className="mt-2">
          The platform uses third-party market information, including Bybit
          market data, to demonstrate cryptocurrency pricing, virtual wallet
          valuation, conversions and simulated trading. Orders are not
          submitted to Bybit or another exchange on your behalf.
        </p>

        <p className="mt-3">
          Available trading features may include market and limit orders, long
          and short positions, stop-loss and take-profit orders, and
          one-cancels-the-other (OCO) relationships where implemented and
          enabled.
        </p>

        <p className="mt-3">
          Market data may be delayed, inaccurate or unavailable. Simulated
          order execution and conversions may differ from actual market
          outcomes because of price movement, liquidity assumptions, quote
          expiration, processing delays and software limitations.
        </p>

        <p className="mt-3">
          Stop-loss and take-profit functionality is not a guarantee of
          execution at a particular price or of continuous monitoring.
          Simulated performance does not predict real trading results. Do not
          use the platform as the sole basis for financial decisions.
        </p>

        <p className="mt-3">
          Virtual wallet balances and addresses do not establish custody or
          ownership of real digital assets. Do not transfer cryptocurrency to
          any address displayed by the demonstration.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          8. Fees and Charges
        </h2>

        <p className="mt-2">
          The platform may calculate simulated fees, exchange rates, spreads
          and other transaction amounts as part of its financial workflows.
          Review the values displayed in the relevant interface before
          confirming a request.
        </p>

        <p className="mt-3">
          Simulated fees and transaction limits may change as the application
          develops. Virtual fees are ledger entries and do not represent a
          charge to your real bank account, card or cryptocurrency wallet.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          9. Refunds, Reversals and Failed Transactions
        </h2>

        <p className="mt-2">
          Failed, rejected, duplicated or incorrectly processed simulated
          transactions may be investigated and corrected through the
          applicable administrative or ledger workflow.
        </p>

        <p className="mt-3">
          A simulated reversal or refund changes virtual balances and records
          only. It does not entitle you to reimbursement in real money or
          digital assets. Report inconsistent records promptly and do not
          exploit errors or submit repeated requests to obtain unintended
          virtual credits.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          10. Prohibited Activities
        </h2>

        <p className="mt-2">
          Do not use Sunrovo Finance for unlawful, fraudulent or abusive
          purposes. Prohibited conduct includes:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            Misrepresenting the demonstration as a licensed financial
            institution or using its records as proof of real funds;
          </li>
          <li>
            Soliciting or accepting real payments, deposits or investments
            through the demonstration;
          </li>
          <li>
            Identity theft, impersonation or unauthorized access to other
            accounts;
          </li>
          <li>
            Attempting to bypass security controls, manipulate balances or
            exploit transaction errors;
          </li>
          <li>
            Introducing malicious code, disrupting availability or accessing
            data without authorization;
          </li>
          <li>
            Using the platform for fraud, unlawful financial activity or other
            conduct prohibited by applicable law.
          </li>
        </ul>

        <p className="mt-3">
          Security incidents and suspected abuse may result in restricted
          access or other appropriate action, subject to applicable law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          11. Suspension and Account Closure
        </h2>

        <p className="mt-2">
          Access to a demonstration account may be restricted, suspended or
          terminated for security risks, misuse, a breach of these Terms,
          maintenance or discontinuation of the project.
        </p>

        <p className="mt-3">
          As a project under active development, test accounts and simulated
          records may be reset, corrected or removed as necessary for
          maintenance and testing, subject to applicable privacy and
          data-protection obligations. Where practicable, notice will be
          provided before planned changes affecting access.
        </p>

        <p className="mt-3">
          Account closure or removal of virtual balances does not create a
          right to a real payment. Any applicable rights concerning personal
          information remain unaffected.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          12. Service Availability
        </h2>

        <p className="mt-2">
          Sunrovo Finance is under active development. Features may be
          incomplete, changed, disabled or discontinued. Availability, data
          persistence, scheduled background processing and uninterrupted
          access are not guaranteed.
        </p>

        <p className="mt-3">
          Maintenance, software defects, network failures, market-data
          interruptions and hosting limitations may affect the demonstration.
          Simulated orders and automated risk controls may be delayed or may
          not execute.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          13. Third-Party Services
        </h2>

        <p className="mt-2">
          The platform relies on external technology services, including
          Vercel hosting, email delivery infrastructure and Bybit market data.
          These services may experience outages, rate limits or other
          restrictions.
        </p>

        <p className="mt-3">
          Use of third-party data does not establish a partnership,
          endorsement, brokerage or custody relationship. If you access an
          external website or service, its own terms and privacy practices may
          apply.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          14. User Responsibilities
        </h2>

        <p className="mt-2">
          When using the demonstration, you are responsible for:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            Using only information you are authorized to provide;
          </li>
          <li>
            Keeping authentication credentials private and reviewing simulated
            account activity;
          </li>
          <li>
            Reporting unexpected behaviour or suspected security incidents;
          </li>
          <li>
            Using virtual balances and transaction records only for
            demonstration purposes;
          </li>
          <li>
            Respecting the rights and privacy of other users and complying
            with applicable law.
          </li>
        </ul>

        <p className="mt-3">
          Personal information submitted during registration and use of the
          platform is addressed in the applicable Privacy Policy.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          15. Intellectual Property
        </h2>

        <p className="mt-2">
          The Sunrovo Finance project name, interface, software and original
          content are subject to the rights of their respective owners.
          Third-party libraries, market data, names and other materials remain
          subject to their applicable licences or terms.
        </p>

        <p className="mt-3">
          Use of the platform does not transfer ownership of intellectual
          property. Any rights granted under an applicable open-source or
          other licence remain unaffected.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          16. Disclaimers
        </h2>

        <p className="mt-2">
          Sunrovo Finance is provided for software demonstration, education
          and testing. It does not provide investment advice, banking
          services, financial recommendations, real-money trading or asset
          custody.
        </p>

        <p className="mt-3">
          The platform is provided as available and may contain errors. No
          guarantee is made about simulated outcomes, market-data accuracy,
          uninterrupted availability or the suitability of the application for
          real financial use.
        </p>

        <p className="mt-3">
          Nothing in these Terms excludes rights or protections that cannot
          lawfully be excluded.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          17. Limitation of Liability
        </h2>

        <p className="mt-2">
          To the extent permitted by applicable law, the project operator is
          not responsible for indirect or consequential losses resulting from
          use of the demonstration, reliance on simulated results or
          interruptions outside its reasonable control.
        </p>

        <p className="mt-3">
          Do not use the platform to carry out or substantiate real financial
          transactions. This limitation does not exclude liability for fraud,
          wilful misconduct or any other liability that cannot lawfully be
          limited or excluded.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          18. Responsibility for Misuse
        </h2>

        <p className="mt-2">
          You remain responsible for unlawful use of the platform, fraud,
          intentional misconduct and material violations of these Terms, to
          the extent provided by applicable law. Nothing in this section
          removes any rights or remedies that cannot lawfully be waived.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          19. Changes to These Terms
        </h2>

        <p className="mt-2">
          These Terms may be updated as the project, its features and
          applicable requirements change. The revised date will be displayed
          on this page. Where required, material changes will be communicated
          or further consent requested.
        </p>

        <p className="mt-3">
          Your continued use of the platform is subject to the updated Terms
          to the extent permitted by applicable law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          20. Governing Law and Disputes
        </h2>

        <p className="mt-2">
          These Terms are subject to applicable law. Concerns relating to the
          demonstration should first be raised with the project operator
          through the published project contact channel, when available.
        </p>

        <p className="mt-3">
          Nothing in these Terms prevents you from exercising applicable
          statutory rights or seeking a remedy through a competent court or
          other authorized body.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          21. Contact
        </h2>

        <p className="mt-2">
          Sunrovo Finance — software portfolio demonstration.
        </p>

        <p className="mt-3">
          For project information and any published contact channels, visit
          the official demonstration website. Never send passwords, app
          passwords, authentication codes or private keys in a support
          request.
        </p>

        <p className="mt-3 break-all">
          Website:{" "}
          <a
            href="https://sunrovo-finace.vercel.app/"
            className="text-primary underline"
          >
            https://sunrovo-finace.vercel.app/
          </a>
        </p>
      </section>
    </LegalPage>
  );
}
