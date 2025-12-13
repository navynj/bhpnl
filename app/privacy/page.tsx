import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | BH P&L',
  description: 'Privacy Policy for BH P&L application',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Privacy Policy
        </h1>
        <div className="prose prose-lg max-w-none">
          <p className="text-sm text-gray-600 mb-8">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700 mb-4">
              This Privacy Policy describes how BH P&L ("we," "our," or "us") collects, uses, and protects your personal information when you use our Service. By using the Service, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">2.1 Information You Provide</h3>
            <p className="text-gray-700 mb-4">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>Account information (name, email address, profile picture)</li>
              <li>Organization and connection information</li>
              <li>Report data and preferences</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">2.2 Information from Third-Party Services</h3>
            <p className="text-gray-700 mb-4">
              When you connect third-party services to our Service, we may collect:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>QuickBooks data (financial information, company data)</li>
              <li>Notion workspace and page information</li>
              <li>Google account information (when using Google authentication)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">2.3 Automatically Collected Information</h3>
            <p className="text-gray-700 mb-4">
              We automatically collect certain information when you use the Service, including:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>Log data (IP address, browser type, access times)</li>
              <li>Usage data (pages visited, features used)</li>
              <li>Device information</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-700 mb-4">We use the collected information for:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>Providing, maintaining, and improving the Service</li>
              <li>Processing your requests and transactions</li>
              <li>Generating financial reports and analytics</li>
              <li>Communicating with you about the Service</li>
              <li>Detecting, preventing, and addressing technical issues</li>
              <li>Complying with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Data Sharing and Disclosure</h2>
            <p className="text-gray-700 mb-4">We do not sell your personal information. We may share your information in the following circumstances:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li><strong>Third-Party Services:</strong> When you connect third-party services (QuickBooks, Notion), we share necessary information to enable integration</li>
              <li><strong>Service Providers:</strong> We may share information with service providers who assist us in operating the Service</li>
              <li><strong>Legal Requirements:</strong> We may disclose information if required by law or in response to valid legal requests</li>
              <li><strong>Business Transfers:</strong> Information may be transferred in connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Security</h2>
            <p className="text-gray-700 mb-4">
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Retention</h2>
            <p className="text-gray-700 mb-4">
              We retain your personal information for as long as necessary to provide the Service and fulfill the purposes described in this Privacy Policy, unless a longer retention period is required or permitted by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Rights and Choices</h2>
            <p className="text-gray-700 mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>Access and receive a copy of your personal information</li>
              <li>Correct inaccurate or incomplete information</li>
              <li>Request deletion of your personal information</li>
              <li>Object to or restrict processing of your information</li>
              <li>Withdraw consent where processing is based on consent</li>
              <li>Disconnect third-party service integrations at any time</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Third-Party Services</h2>
            <p className="text-gray-700 mb-4">
              Our Service integrates with third-party services including QuickBooks, Notion, and Google. These services have their own privacy policies, and we encourage you to review them. We are not responsible for the privacy practices of these third-party services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Cookies and Tracking Technologies</h2>
            <p className="text-gray-700 mb-4">
              We use cookies and similar tracking technologies to track activity on our Service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Children's Privacy</h2>
            <p className="text-gray-700 mb-4">
              Our Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children under 18.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. International Data Transfers</h2>
            <p className="text-gray-700 mb-4">
              Your information may be transferred to and maintained on computers located outside of your state, province, country, or other governmental jurisdiction where data protection laws may differ.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Changes to This Privacy Policy</h2>
            <p className="text-gray-700 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have any questions about this Privacy Policy, please contact us through the Service or using the contact information provided in your account settings.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

