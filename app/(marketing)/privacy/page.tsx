import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Sunrovo Finance.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="PRIVACY POLICY"
      effectiveDate="16 September 2016"
    >
      <p>
        Sunrovo Finance respects the privacy and security of customer
        information. This Privacy Policy explains how Sunrovo Finance collects, uses,
        stores and protects personal information when customers use its
        Services.
      </p>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          1. Information We Collect
        </h2>

        <p className="mt-2">
          Depending on the Services used, Sunrovo Finance may collect:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Name and contact information;</li>
          <li>Date of birth and identification information;</li>
          <li>KYC and verification information;</li>
          <li>Account and transaction information;</li>
          <li>Payment and banking information;</li>
          <li>Device and technical information;</li>
          <li>Login and security information;</li>
          <li>Communications with Sunrovo Finance; and</li>
          <li>
            Information required to prevent fraud and comply with applicable
            law.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          2. How We Use Information
        </h2>

        <p className="mt-2">
          Sunrovo Finance may use customer information to:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Open and manage accounts;</li>
          <li>Process transactions and payments;</li>
          <li>Provide banking Services;</li>
          <li>Verify customer identity;</li>
          <li>Prevent fraud and financial crime;</li>
          <li>Meet KYC, AML and sanctions obligations;</li>
          <li>Maintain security;</li>
          <li>Provide customer support;</li>
          <li>Improve Services;</li>
          <li>Meet legal and regulatory obligations; and</li>
          <li>
            Protect the rights and property of Sunrovo Finance and its customers.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          3. Financial and Transaction Information
        </h2>

        <p className="mt-2">
          Sunrovo Finance maintains records of customer accounts, deposits, withdrawals,
          transfers, payments and other transactions as required for banking
          operations, security, accounting and regulatory purposes.
        </p>

        <p className="mt-2">
          Transaction records may be retained for periods required by
          applicable law and regulatory requirements.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          4. Cookies and Technical Information
        </h2>

        <p className="mt-2">
          Sunrovo Finance may use cookies and similar technologies to maintain secure
          sessions, remember preferences, analyze service performance and
          improve the customer experience.
        </p>

        <p className="mt-2">
          Customers may be able to control certain cookies through their
          browser or device settings.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          5. Sharing Information
        </h2>

        <p className="mt-2">
          Sunrovo Finance may share information where necessary with:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Payment networks and financial institutions;</li>
          <li>Service providers;</li>
          <li>Technology and security providers;</li>
          <li>Regulators and government authorities;</li>
          <li>Law-enforcement agencies where legally required;</li>
          <li>Professional advisers; and</li>
          <li>
            Other parties where authorized by the customer or permitted by law.
          </li>
        </ul>

        <p className="mt-2">
          Sunrovo Finance does not sell customer financial information for unrelated
          commercial purposes.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          6. Regulatory and Legal Disclosure
        </h2>

        <p className="mt-2">
          Sunrovo Finance may disclose customer information where required or permitted by
          law, including for:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Fraud investigations;</li>
          <li>AML and counter-terrorist-financing requirements;</li>
          <li>Sanctions compliance;</li>
          <li>Court orders;</li>
          <li>Regulatory investigations;</li>
          <li>Law-enforcement requests; and</li>
          <li>
            Protection of customers, the Bank or the financial system.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          7. International Transfers
        </h2>

        <p className="mt-2">
          Where customer information must be transferred or processed outside
          the customer&apos;s country, Sunrovo Finance will take appropriate measures required
          by applicable data-protection laws.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          8. Information Security
        </h2>

        <p className="mt-2">
          Sunrovo Finance uses reasonable administrative, technical and organizational
          measures designed to protect customer information against unauthorized
          access, alteration, disclosure, loss and misuse.
        </p>

        <p className="mt-2">
          No electronic system can be guaranteed to be completely secure.
          Customers must also protect their passwords, devices and
          authentication credentials.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          9. Data Retention
        </h2>

        <p className="mt-2">
          Sunrovo Finance retains personal and financial information for as long as
          reasonably necessary to provide Services and to meet legal,
          regulatory, accounting, fraud-prevention and dispute-resolution
          requirements.
        </p>

        <p className="mt-2">
          Certain financial records may be retained after an account is closed
          where required by law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          10. Customer Privacy Rights
        </h2>

        <p className="mt-2">
          Subject to applicable law, customers may have rights concerning their
          personal information, including rights to:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Request access to personal information;</li>
          <li>Request correction of inaccurate information;</li>
          <li>Request deletion where legally available;</li>
          <li>Object to or restrict certain processing;</li>
          <li>Withdraw consent where processing is based on consent; and</li>
          <li>
            Submit a privacy complaint to the appropriate authority.
          </li>
        </ul>

        <p className="mt-2">
          These rights may be limited where retention or processing is required
          by law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          11. Account Deletion
        </h2>

        <p className="mt-2">
          Customers may request account closure through Sunrovo Finance&apos;s approved
          channels.
        </p>

        <p className="mt-2">
          Closing an account does not necessarily result in immediate deletion
          of all information. Financial and regulatory records may need to be
          retained for the period required by law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          12. Children
        </h2>

        <p className="mt-2">
          Sunrovo Finance&apos;s Services are intended for persons who are legally eligible
          to open and operate the relevant financial account.
        </p>

        <p className="mt-2">
          Sunrovo Finance does not knowingly provide financial accounts to persons who are
          legally prohibited from holding them.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          13. Communications
        </h2>

        <p className="mt-2">
          Sunrovo Finance may send customers service-related communications concerning:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Account activity;</li>
          <li>Transactions;</li>
          <li>Security alerts;</li>
          <li>Service changes;</li>
          <li>Regulatory requirements; and</li>
          <li>
            Other information necessary to operate the customers account.
          </li>
        </ul>

        <p className="mt-2">
          Marketing communications, where applicable, will be handled in
          accordance with applicable law and customer preferences.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          14. Automated Security and Fraud Detection
        </h2>

        <p className="mt-2">
          Sunrovo Finance may use automated systems to detect suspicious transactions,
          fraud, account compromise, sanctions concerns and other security
          risks.
        </p>

        <p className="mt-2">
          Where required by applicable law, customers may have rights concerning
          certain automated decisions and may request appropriate review.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          15. Third-Party Websites and Services
        </h2>

        <p className="mt-2">
          Sunrovo Finance may provide links or integrations to third-party websites and
          services.
        </p>

        <p className="mt-2">
          Third-party services operate under their own privacy policies and
          terms. Sunrovo Finance is not responsible for the privacy practices of
          independent third parties.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          16. Changes to This Privacy Policy
        </h2>

        <p className="mt-2">
          Sunrovo Finance may update this Privacy Policy when its Services, technology,
          legal obligations or data-processing practices change.
        </p>

        <p className="mt-2">
          Material changes will be communicated through appropriate channels
          where required.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          17. Contact Us
        </h2>

        <div className="mt-2 space-y-1">
          <p>Sunrovo Finance</p>
          <p>Website: www.fiseholdings.com</p>
          <p>Privacy Contact: fiseholdings@supportplt.com</p>
        </div>
      </section>
    </LegalPage>
  );
}