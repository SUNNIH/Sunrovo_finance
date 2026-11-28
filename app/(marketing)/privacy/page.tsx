import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for the Sunrovo Finance software demonstration.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="PRIVACY POLICY"
      effectiveDate="28 November 2026"
    >

      <p>
        Sunrovo Finance respects the privacy of its users. This Privacy Policy
        explains how personal information may be collected, used, stored,
        shared and protected when you register for or use the Sunrovo Finance
        website and its features.
      </p>

      <p className="mt-3 font-semibold">
        Sunrovo Finance is a live software portfolio demonstration under
        active development, not a licensed financial institution. Financial
        activity and balances are simulated, but personal information
        submitted to the live website is real data. Do not deposit, transfer
        or invest real funds through the platform.
      </p>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          1. Information We Collect
        </h2>

        <p className="mt-2">
          Depending on the features you use, Sunrovo Finance may collect the
          following information:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            Your full name, email address and account registration details;
          </li>
          <li>
            Profile and onboarding details, including country, phone number,
            date of birth, preferred currency and account type, where
            provided;
          </li>
          <li>
            Password hashes, email verification status, security settings and
            information associated with multi-factor authentication (MFA) and
            transaction PINs;
          </li>
          <li>
            Session records, IP addresses, browser information, device
            identifiers, trusted device records and login activity;
          </li>
          <li>
            Simulated account balances, wallet records, transaction history,
            deposit and withdrawal requests, transfer details, trading orders
            and watchlists;
          </li>
          <li>
            Information you submit in transaction notes, support
            communications or other platform forms; and
          </li>
          <li>
            Technical records and audit logs used to operate, troubleshoot and
            protect the platform.
          </li>
        </ul>

        <p className="mt-2">
          Onboarding identity checks are simulated and do not constitute
          regulated Know Your Customer (KYC) verification. Do not submit
          government identification documents, real payment credentials,
          private keys, recovery phrases or other sensitive information that
          is unnecessary for using the demonstration.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          2. How We Use Information
        </h2>

        <p className="mt-2">
          We use personal information for purposes associated with operating
          and developing Sunrovo Finance, including:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            Creating and managing user accounts and profiles;
          </li>
          <li>
            Verifying email addresses and supporting secure login, MFA and
            password recovery;
          </li>
          <li>
            Providing simulated banking, cryptocurrency conversion and trading
            features;
          </li>
          <li>
            Processing and reviewing simulated transaction requests and
            maintaining ledger records;
          </li>
          <li>
            Protecting accounts, preventing unauthorized access and
            investigating misuse;
          </li>
          <li>
            Sending account-related communications and notifications;
          </li>
          <li>
            Diagnosing software errors, testing reliability and improving the
            platform; and
          </li>
          <li>
            Responding to privacy requests and meeting applicable legal
            obligations.
          </li>
        </ul>

        <p className="mt-2">
          Where applicable law requires a lawful basis for processing, the
          basis may include providing requested platform functionality,
          legitimate interests in operating and securing the demonstration,
          compliance with legal obligations, or consent where required.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          3. Simulated Financial and Transaction Information
        </h2>

        <p className="mt-2">
          Sunrovo Finance maintains records of virtual current and savings
          accounts, cryptocurrency wallets, deposits, withdrawals, transfers,
          conversions, trading orders and positions. These records support
          simulated financial workflows, accounting, reconciliation,
          administrative review and software testing.
        </p>

        <p className="mt-2">
          Displayed account numbers, wallet addresses, balances and
          transaction records are for demonstration purposes. They do not
          represent real funds or assets held by Sunrovo Finance. Do not use
          real bank details or send real funds or cryptocurrency to the
          platform.
        </p>

        <p className="mt-2">
          Although transactions are simulated, the account information and
          activity associated with an identifiable user may still be personal
          information and are treated accordingly.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          4. Cookies and Technical Information
        </h2>

        <p className="mt-2">
          Sunrovo Finance uses session cookies and related security mechanisms
          to maintain authentication and protect requests. Device and browser
          information may also be used to recognize trusted devices and detect
          unusual login activity.
        </p>

        <p className="mt-2">
          You can manage cookies through your browser settings. Blocking or
          deleting essential cookies may prevent login or other authenticated
          features from working correctly. Signing out ends your current
          authenticated access; clearing browser cookies alone does not
          necessarily revoke a server-side session.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          5. Sharing Information
        </h2>

        <p className="mt-2">
          Information may be accessed or processed where necessary by the
          platform operator, authorized administrators and service providers
          supporting the demonstration, including:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            Vercel, for application hosting, request processing and
            operational logs;
          </li>
          <li>
            The PostgreSQL database hosting provider, for storage and
            retrieval of application records;
          </li>
          <li>
            Google Gmail SMTP, when configured for email verification and
            password recovery, which processes recipient addresses and message
            contents;
          </li>
          <li>
            Bybit, for public cryptocurrency market data and related market
            requests; and
          </li>
          <li>
            Other parties where authorized by you or where disclosure is
            required by applicable law.
          </li>
        </ul>

        <p className="mt-2">
          Bybit market-data integration is not intended to execute real trades
          or provide custody of user funds. Technical information associated
          with requests may be processed by the relevant provider. We do not
          intend to sell personal information or use it for unrelated
          advertising purposes.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          6. Legal Disclosure
        </h2>

        <p className="mt-2">
          Sunrovo Finance may disclose information where necessary and
          permitted or required by applicable law, such as to respond to valid
          court orders or lawful requests, investigate security incidents or
          unlawful activity, protect the rights and safety of users, or
          establish or defend legal claims.
        </p>

        <p className="mt-2">
          The demonstration is not a regulated bank or financial institution
          and does not claim to operate a regulated financial crime monitoring
          or sanctions-screening program.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          7. International Transfers
        </h2>

        <p className="mt-2">
          Cloud hosting, database services, email delivery and market-data
          infrastructure may process information in countries other than your
          country of residence.
        </p>

        <p className="mt-2">
          Where applicable, international processing and transfers are subject
          to relevant data-protection requirements. The locations and
          safeguards used by service providers depend on their configurations
          and terms. No particular country of storage is guaranteed by this
          policy.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          8. Information Security
        </h2>

        <p className="mt-2">
          Sunrovo Finance uses technical controls designed to protect
          information, including password hashing, session management, email
          verification mechanisms, optional multi-factor authentication,
          access controls, request protection, rate limiting and audit
          logging.
        </p>

        <p className="mt-2">
          The platform is under active development, and no software system can
          be guaranteed to be completely secure. You should use a unique
          password, protect your devices and authentication credentials, and
          avoid sharing verification links, password reset links or security
          codes.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          9. Data Retention
        </h2>

        <p className="mt-2">
          Personal information and simulated transaction records may be
          retained for as long as reasonably necessary to operate accounts,
          maintain security, investigate errors, preserve accounting
          consistency and meet applicable legal obligations.
        </p>

        <p className="mt-2">
          Session records, verification tokens, technical logs and backups may
          have different lifetimes. Expiration of a token or session does not
          necessarily mean all related records are immediately deleted. The
          platform does not promise a fixed retention period for every
          category of information.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          10. User Privacy Rights
        </h2>

        <p className="mt-2">
          Depending on the applicable data-protection law, you may have the
          right to:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            Request access to personal information relating to you;
          </li>
          <li>
            Request correction of inaccurate or incomplete information;
          </li>
          <li>
            Request deletion of personal information where applicable;
          </li>
          <li>
            Object to or request restriction of certain processing;
          </li>
          <li>
            Request a copy of your information in a portable format where
            applicable;
          </li>
          <li>
            Withdraw consent where processing relies on consent; and
          </li>
          <li>
            Lodge a complaint with the relevant data-protection authority.
          </li>
        </ul>

        <p className="mt-2">
          These rights may be subject to lawful exceptions and reasonable
          identity verification before a request is fulfilled.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          11. Account Closure and Deletion
        </h2>

        <p className="mt-2">
          You may request closure of your demonstration account or deletion of
          your personal information by contacting the platform operator.
          Account closure does not necessarily mean immediate deletion of
          every related record.
        </p>

        <p className="mt-2">
          Some information may need to be retained temporarily for security,
          backup management, simulated ledger consistency, dispute resolution
          or applicable legal obligations. Deletion requests will be assessed
          in accordance with applicable law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          12. Children
        </h2>

        <p className="mt-2">
          Sunrovo Finance is intended for adult users exploring simulated
          financial software. It is not designed for children. Children should
          not create accounts or submit personal information through the
          demonstration.
        </p>

        <p className="mt-2">
          If information relating to a child has been submitted, the platform
          operator should be contacted so the information can be reviewed and
          handled appropriately.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          13. Communications
        </h2>

        <p className="mt-2">
          Sunrovo Finance may send service-related messages, including:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            Email verification and resend verification messages;
          </li>
          <li>
            Password reset instructions;
          </li>
          <li>
            Account activity and security notifications;
          </li>
          <li>
            Simulated transaction updates and administrative review
            notifications; and
          </li>
          <li>
            Important platform or policy changes.
          </li>
        </ul>

        <p className="mt-2">
          These messages support the operation and security of your account.
          If marketing communications are introduced, they will be subject to
          applicable consent and opt-out requirements.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          14. Automated Security and Administrative Review
        </h2>

        <p className="mt-2">
          Automated controls may be used to limit repeated requests, check
          authentication, validate transaction instructions and detect invalid
          or unauthorized activity.
        </p>

        <p className="mt-2">
          Authorized administrators may review simulated deposit, withdrawal
          and external transfer requests and relevant audit records. Automated
          checks and administrative decisions in this demonstration are not
          real credit assessments or regulated financial eligibility
          decisions.
        </p>

        <p className="mt-2">
          Where applicable law provides rights relating to automated
          decisions, you may request an explanation or appropriate review.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          15. Third-Party Websites and Services
        </h2>

        <p className="mt-2">
          Sunrovo Finance may display third-party market information, use
          external infrastructure or provide links to other websites. External
          services may have their own privacy policies and terms.
        </p>

        <p className="mt-2">
          If you follow an external link, review the destination&rsquo;s
          privacy policy before submitting information. The use of third-party
          infrastructure does not remove any privacy responsibilities that
          apply to Sunrovo Finance.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          16. Changes to This Privacy Policy
        </h2>

        <p className="mt-2">
          This Privacy Policy may be updated as Sunrovo Finance evolves,
          including changes to features, service providers, security controls
          or data-processing practices.
        </p>

        <p className="mt-2">
          The effective date will be updated when changes take effect, and
          material changes will be communicated where required by applicable
          law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          17. Contact Us
        </h2>

        <p className="mt-2">
          For questions, privacy requests or concerns about the handling of
          personal information, contact the Sunrovo Finance project operator
          through a verified project contact channel. Never include passwords,
          verification codes or reset links in a privacy request.
        </p>

        <div className="mt-2 space-y-1">
          <p className="font-semibold">Sunrovo Finance</p>
          <p>
            Website:{" "}
            <a
              href="https://sunrovo-finace.vercel.app/"
              className="underline break-all"
            >
              https://sunrovo-finace.vercel.app/
            </a>
          </p>
        </div>
      </section>

    </LegalPage>
  );
}
