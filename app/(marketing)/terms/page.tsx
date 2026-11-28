import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Sunrovo Finance.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="TERMS OF SERVICE"
      effectiveDate="16 September 2016"
    >
      <p>
        Last Updated: 16 September 2024
      </p>

      <p>
        These Terms of Service (“Terms”) govern your access to and use of the
        banking, financial and digital services provided by FISE HOLDING TRUST
        BANK (“FISE,” “the Bank,” “we,” “us” or “our”) through our website,
        mobile applications, electronic banking platforms, branches and other
        approved channels (collectively, the “Services”).
      </p>

      <p>
        By opening an account, accessing the Services or conducting a transaction
        through FISE, you agree to these Terms and any applicable
        product-specific terms, notices and policies.
      </p>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          1. Banking Services
        </h2>

        <p className="mt-2">
          Depending on your eligibility and the products available in your
          jurisdiction, FISE may provide services including:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Current and savings accounts;</li>
          <li>Deposits and withdrawals;</li>
          <li>Domestic and international transfers;</li>
          <li>Electronic and mobile banking;</li>
          <li>Payment services;</li>
          <li>Debit or payment cards;</li>
          <li>Foreign-currency services;</li>
          <li>
            Digital-asset or cryptocurrency services where legally permitted;
          </li>
          <li>Statements and transaction records; and</li>
          <li>Other financial products made available by the Bank.</li>
        </ul>

        <p className="mt-3">
          Specific products may be subject to additional terms, eligibility
          requirements, fees, limits and regulatory requirements.
        </p>

        <p className="mt-3">
          FISE will provide its banking services in accordance with applicable
          laws, regulations and regulatory requirements.
        </p>

        <p className="mt-3 font-semibold">
          Regulatory information, including the Banks applicable licence,
          regulatory authority, licence number, registered office and
          deposit-insurance status, should be displayed on the Banks official
          website and customer documentation.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          2. Eligibility and Account Opening
        </h2>

        <p className="mt-2">
          You must provide accurate and complete information when opening an
          account or using our Services.
        </p>

        <p className="mt-3">
          FISE may require identification and verification documents, including
          information required for customer identification, Know Your Customer
          (“KYC”), anti-money laundering (“AML”), counter-terrorist financing and
          sanctions-screening requirements.
        </p>

        <p className="mt-3">
          You must promptly update information that becomes inaccurate or
          changes.
        </p>

        <p className="mt-3">
          FISE may refuse or delay account opening where permitted or required
          by law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          3. Account Security
        </h2>

        <p className="mt-2">
          You are responsible for maintaining the confidentiality of your
          passwords, PINs, authentication credentials, cards, devices and other
          security information.
        </p>

        <p className="mt-3">
          You must notify FISE immediately if you believe that:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Your account has been accessed without authorization;</li>
          <li>
            Your password, PIN or authentication credentials have been
            compromised;
          </li>
          <li>Your card or device has been lost or stolen; or</li>
          <li>A transaction appears unauthorized or fraudulent.</li>
        </ul>

        <p className="mt-3">
          FISE may suspend access to an account or transaction where reasonably
          necessary to protect the customer, the Bank or the financial system.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          4. Deposits and Account Balances
        </h2>

        <p className="mt-2">
          Deposits and credits to your account will be recorded in accordance
          with FISEs banking systems and applicable banking procedures.
        </p>

        <p className="mt-3">
          A transaction may remain pending until it has been fully processed
          and cleared.
        </p>

        <p className="mt-3">
          FISE may correct an account entry where an error, duplicate credit,
          fraudulent transaction or unauthorized entry is identified, subject
          to applicable law and customer-notification requirements.
        </p>

        <p className="mt-3">
          Account statements and transaction records made available through
          FISEs systems may be used as evidence of account activity, subject
          to applicable law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          5. Transfers and Payments
        </h2>

        <p className="mt-2">
          Customers may initiate transfers and payments through approved FISE
          channels.
        </p>

        <p className="mt-3">
          Transactions may be subject to:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Authentication requirements;</li>
          <li>Daily or transaction limits;</li>
          <li>Recipient verification;</li>
          <li>Fraud and security screening;</li>
          <li>Regulatory checks;</li>
          <li>Processing times; and</li>
          <li>Applicable fees.</li>
        </ul>

        <p className="mt-3">
          Customers are responsible for verifying recipient information before
          authorizing a transaction.
        </p>

        <p className="mt-3">
          Where a payment has already been completed, cancellation or reversal
          may not be possible. FISE may nevertheless investigate and process
          recovery or reversal requests where permitted by the applicable
          payment system, recipient institution and law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          6. Withdrawals
        </h2>

        <p className="mt-2">
          Withdrawals may be subject to available balance requirements,
          transaction limits, identity verification, security checks and
          applicable fees.
        </p>

        <p className="mt-3">
          FISE may delay or restrict a withdrawal where required for fraud
          prevention, legal compliance, sanctions screening, investigation or
          other legitimate banking purposes.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          7. Cryptocurrency and Digital-Asset Services
        </h2>

        <p className="mt-2">
          Where FISE makes cryptocurrency or digital-asset services available,
          such services will be subject to applicable law, regulatory
          requirements and FISEs specific digital-asset terms.
        </p>

        <p className="mt-3">
          Digital assets may involve significant price volatility and
          transaction risks.
        </p>

        <p className="mt-3">
          Customers are responsible for confirming wallet addresses and
          transaction details before authorizing a digital-asset transfer.
          Blockchain transactions may be irreversible once confirmed.
        </p>

        <p className="mt-3">
          Cryptocurrency balances should not automatically be treated as
          equivalent to insured bank deposits unless FISE expressly states
          otherwise and applicable law provides such treatment.
        </p>

        <p className="mt-3">
          FISE may suspend or restrict digital-asset transactions where required
          for security, fraud prevention, AML/KYC compliance, sanctions
          screening or regulatory purposes.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          8. Fees and Charges
        </h2>

        <p className="mt-2">
          Applicable fees, charges, exchange rates and transaction limits will
          be communicated through FISEs website, account documentation,
          transaction interface or other approved communication channels.
        </p>

        <p className="mt-3">
          Fees may vary according to the type of account, transaction, payment
          method, currency, service or customer category.
        </p>

        <p className="mt-3">
          Where required by law, customers will receive appropriate notice of
          material changes to applicable fees.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          9. Refunds, Reversals and Failed Transactions
        </h2>

        <p className="mt-2">
          Banking transactions are different from ordinary retail purchases and
          are not automatically refundable.
        </p>

        <p className="mt-3">
          Where a transaction fails, is duplicated, is incorrectly processed or
          is otherwise eligible for reversal, FISE will investigate the
          transaction and process any applicable correction, refund or reversal
          in accordance with applicable law and payment-system rules.
        </p>

        <p className="mt-3">
          A customer must report a suspected unauthorized or erroneous
          transaction promptly.
        </p>

        <p className="mt-3">
          Refunds or reversals may be subject to verification and may take time
          to process because another financial institution, payment processor or
          payment network may be involved.
        </p>

        <p className="mt-3">
          Fees already charged may be refundable where required by law or where
          FISE determines that the fee resulted from an error attributable to
          the Bank.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          10. Prohibited Activities
        </h2>

        <p className="mt-2">
          Customers must not use FISE Services for unlawful or fraudulent
          purposes, including:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Money laundering;</li>
          <li>Terrorist financing;</li>
          <li>Fraud or attempted fraud;</li>
          <li>Sanctions evasion;</li>
          <li>Identity theft;</li>
          <li>Unauthorized access to another persons account;</li>
          <li>Use of stolen payment credentials;</li>
          <li>Financing unlawful activities;</li>
          <li>Manipulation or abuse of payment systems; or</li>
          <li>Any activity prohibited by applicable law.</li>
        </ul>

        <p className="mt-3">
          FISE may report suspicious activity to competent authorities where
          required or permitted by law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          11. Suspension and Account Closure
        </h2>

        <p className="mt-2">
          FISE may restrict, suspend or close an account where permitted or
          required by law, including where:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Fraud or suspicious activity is detected;</li>
          <li>KYC information cannot be satisfactorily verified;</li>
          <li>The account is used for prohibited activity;</li>
          <li>A legal or regulatory requirement applies;</li>
          <li>Security risks are identified; or</li>
          <li>The customer materially breaches these Terms.</li>
        </ul>

        <p className="mt-3">
          Where legally permitted, FISE will provide appropriate notice.
        </p>

        <p className="mt-3">
          Any remaining eligible balance will be handled in accordance with
          applicable law and the circumstances surrounding the account closure.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          12. Service Availability
        </h2>

        <p className="mt-2">
          FISE aims to maintain reliable banking services but does not guarantee
          uninterrupted availability.
        </p>

        <p className="mt-3">
          Services may occasionally be unavailable because of maintenance,
          telecommunications failures, payment-network interruptions,
          cybersecurity incidents, technical failures, regulatory requirements
          or circumstances beyond the Banks reasonable control.
        </p>

        <p className="mt-3">
          FISE will take reasonable measures to restore affected Services.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          13. Third-Party Services
        </h2>

        <p className="mt-2">
          Certain Services may depend on payment networks, correspondent banks,
          card networks, telecommunications providers, technology providers or
          other third parties.
        </p>

        <p className="mt-3">
          Third-party services may be governed by additional terms and may be
          subject to processing delays or availability limitations outside
          FISEs direct control.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          14. Customer Responsibilities
        </h2>

        <p className="mt-2">
          Customers are responsible for:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Providing accurate information;</li>
          <li>Protecting account credentials;</li>
          <li>Reviewing account statements and transaction notifications;</li>
          <li>Reporting unauthorized transactions promptly;</li>
          <li>Complying with applicable laws; and</li>
          <li>Using FISE Services only for lawful purposes.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          15. Intellectual Property
        </h2>

        <p className="mt-2">
          The FISE name, trademarks, logos, software, website content, designs
          and related intellectual property belong to FISE or its licensors.
        </p>

        <p className="mt-3">
          Customers may not reproduce, modify, distribute or commercially
          exploit FISE intellectual property without prior written
          authorization.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          16. Disclaimers
        </h2>

        <p className="mt-2">
          FISE will provide its Services using reasonable professional and
          operational standards.
        </p>

        <p className="mt-3">
          Nothing in these Terms excludes or limits liability that cannot
          legally be excluded or limited under applicable law.
        </p>

        <p className="mt-3">
          FISE does not guarantee that every Service will be available at all
          times or that every transaction will be completed within a particular
          period where processing depends on external institutions or payment
          networks.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          17. Limitation of Liability
        </h2>

        <p className="mt-2">
          To the maximum extent permitted by applicable law, FISE will not be
          liable for indirect, incidental, consequential or special losses
          arising from the use of the Services where such losses were not
          reasonably foreseeable.
        </p>

        <p className="mt-3">
          FISE will not be responsible for losses caused by circumstances
          outside its reasonable control, including telecommunications failures,
          payment-network failures, acts of government, natural disasters, cyber
          incidents affecting third-party infrastructure or other force-majeure
          events.
        </p>

        <p className="mt-3">
          Nothing in this section limits liability where such limitation is
          prohibited by applicable law, including liability arising from fraud,
          willful misconduct or other non-excludable liability.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          18. Indemnification
        </h2>

        <p className="mt-2">
          To the extent permitted by law, you agree to indemnify FISE against
          losses, claims, costs and expenses arising from your unlawful use of
          the Services, fraud, intentional misconduct or material breach of
          these Terms.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          19. Changes to These Terms
        </h2>

        <p className="mt-2">
          FISE may update these Terms from time to time to reflect changes in
          its Services, technology, business practices or applicable legal and
          regulatory requirements.
        </p>

        <p className="mt-3">
          Material changes will be communicated through appropriate channels
          where required by law.
        </p>

        <p className="mt-3">
          Continued use of the Services after the effective date of updated
          Terms constitutes acceptance of the revised Terms, subject to
          applicable legal requirements.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          20. Governing Law and Disputes
        </h2>

        <p className="mt-2">
          These Terms are governed by the laws applicable to FISEs operations
          and the relevant customer relationship.
        </p>

        <p className="mt-3">
          Customers should first contact FISE to attempt to resolve complaints
          or disputes.
        </p>

        <p className="mt-3">
          Nothing in these Terms prevents a customer from exercising any
          statutory right to complain to a competent regulator, ombudsman, court
          or other authorized dispute-resolution body.
        </p>

        <p className="mt-3 font-semibold">
          Applicable Law
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          21. Contact
        </h2>

        <div className="mt-2 space-y-1">
          <p className="font-semibold">FISE HOLDING TRUST BANK</p>
          <p>Website: www.fiseholdings.com</p>
          <p>Email: fiseholdings@supportplt.com</p>
        </div>
      </section>
    </LegalPage>
  );
}