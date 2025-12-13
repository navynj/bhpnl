import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'End User License Agreement | BH P&L',
  description: 'End User License Agreement for BH P&L application',
};

export default function EULAPage() {
  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          End User License Agreement
        </h1>
        <div className="prose prose-lg max-w-none">
          <p className="text-sm text-gray-600 mb-8">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Agreement to Terms</h2>
            <p className="text-gray-700 mb-4">
              By accessing or using the BH P&L application ("Service"), you agree to be bound by this End User License Agreement ("EULA"). If you do not agree to these terms, you may not use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. License Grant</h2>
            <p className="text-gray-700 mb-4">
              Subject to your compliance with this EULA, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your internal business purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Restrictions</h2>
            <p className="text-gray-700 mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li>Copy, modify, or create derivative works of the Service</li>
              <li>Reverse engineer, decompile, or disassemble the Service</li>
              <li>Remove any proprietary notices or labels from the Service</li>
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Interfere with or disrupt the Service or servers connected to the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Intellectual Property</h2>
            <p className="text-gray-700 mb-4">
              The Service and its original content, features, and functionality are owned by us and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Third-Party Services</h2>
            <p className="text-gray-700 mb-4">
              The Service integrates with third-party services including QuickBooks, Notion, and Google. Your use of these third-party services is subject to their respective terms of service and privacy policies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data and Privacy</h2>
            <p className="text-gray-700 mb-4">
              Your use of the Service is also governed by our Privacy Policy. Please review our Privacy Policy to understand how we collect, use, and protect your information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Disclaimer of Warranties</h2>
            <p className="text-gray-700 mb-4">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Limitation of Liability</h2>
            <p className="text-gray-700 mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Termination</h2>
            <p className="text-gray-700 mb-4">
              We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason, including if you breach this EULA.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Changes to This Agreement</h2>
            <p className="text-gray-700 mb-4">
              We reserve the right to modify this EULA at any time. We will notify users of any material changes by updating the "Last Updated" date at the top of this page. Your continued use of the Service after such modifications constitutes acceptance of the updated EULA.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Governing Law</h2>
            <p className="text-gray-700 mb-4">
              This EULA shall be governed by and construed in accordance with the laws of the jurisdiction in which we operate, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Contact Information</h2>
            <p className="text-gray-700 mb-4">
              If you have any questions about this EULA, please contact us through the Service or via the contact information provided in our Privacy Policy.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

