import React from "react";

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 backdrop-blur-sm bg-white/90">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Terms & Conditions
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Last Updated: May 12, 2026
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-12">
          {/* Introduction */}
          <section className="mb-10">
            <p className="text-slate-700 leading-relaxed">
              Welcome to our NFT gifting platform. By accessing or using our
              service, you agree to be bound by these Terms and Conditions.
              Please read them carefully before proceeding.
            </p>
          </section>

          {/* Section 1 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                1
              </span>
              Acceptance of Terms
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p>
                By creating an account or using our platform, you acknowledge
                that you have read, understood, and agree to these terms.
              </p>
              <p>
                If you do not agree to these terms, you must not access or use
                our service.
              </p>
              <p>
                We reserve the right to modify these terms at any time.
                Continued use of the platform after changes constitutes
                acceptance of the revised terms.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                2
              </span>
              Eligibility
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p>You must be at least 18 years old to use this service.</p>
              <p>
                You must have the legal capacity to enter into binding contracts
                in your jurisdiction.
              </p>
              <p>
                You represent that all information you provide is accurate and
                current.
              </p>
              <p>
                Accounts found to be in violation of age requirements will be
                immediately terminated.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                3
              </span>
              NFT Gifting Service
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p>
                <strong>Gift Creation:</strong> Users can create gifts
                containing NFTs and cryptocurrency (USDC or other supported
                tokens) to be claimed by authorized recipients.
              </p>
              <p>
                <strong>Escrow:</strong> All gifts are held in secure smart
                contract escrow until the delivery date and password
                verification.
              </p>
              <p>
                <strong>Delivery:</strong> Recipients can claim gifts only after
                the specified delivery date by providing the correct
                password/salt.
              </p>
              <p>
                <strong>Cancellation:</strong> Senders may cancel unclaimed
                gifts at any time before they are claimed. Cancelled gifts will
                burn the NFT and return tokens to the sender.
              </p>
              <p>
                <strong>Irreversibility:</strong> Once a gift is claimed, the
                transaction cannot be reversed.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                4
              </span>
              Wallet and Security
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p>
                You are solely responsible for maintaining the security of your
                cryptocurrency wallet and private keys.
              </p>
              <p>
                We do not have access to your private keys and cannot recover
                lost wallets or passwords.
              </p>
              <p>
                You must keep your gift passwords/salts secure. Lost passwords
                cannot be recovered.
              </p>
              <p>
                We are not liable for any unauthorized access to your wallet or
                funds due to your failure to maintain security.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                5
              </span>
              Fees and Payments
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p>
                All blockchain transactions incur network fees (gas fees) paid
                directly to the blockchain network.
              </p>
              <p>Minimum gift amounts are enforced (1 USDC or equivalent).</p>
              <p>
                A small amount of SOL is required in the gift escrow for rent
                exemption.
              </p>
              <p>
                We may charge platform fees in the future, with advance notice
                to users.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                6
              </span>
              Prohibited Activities
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>
                  Use the service for money laundering, terrorist financing, or
                  other illegal activities
                </li>
                <li>Gift stolen, counterfeit, or unlawfully obtained NFTs</li>
                <li>Harass, threaten, or defraud other users</li>
                <li>
                  Attempt to exploit vulnerabilities in our smart contracts
                </li>
                <li>
                  Use the service in violation of any applicable laws or
                  regulations
                </li>
                <li>Impersonate others or provide false information</li>
                <li>Interfere with the proper functioning of the platform</li>
              </ul>
            </div>
          </section>

          {/* Section 7 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                7
              </span>
              Intellectual Property
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p>
                Users retain all rights to the NFTs they own and gift through
                the platform.
              </p>
              <p>
                Our platform name, logo, and original content are protected by
                intellectual property laws.
              </p>
              <p>
                You may not copy, modify, or distribute our platform code or
                branding without permission.
              </p>
              <p>
                We do not claim ownership of any user-generated content or NFTs.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                8
              </span>
              Smart Contract Risks
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p className="font-semibold text-amber-700">
                Important: Blockchain transactions are irreversible.
              </p>
              <p>
                Our smart contracts are deployed on the Solana blockchain and
                cannot be modified after deployment.
              </p>
              <p>
                While we have taken measures to ensure security, smart contracts
                may contain unforeseen vulnerabilities.
              </p>
              <p>
                You acknowledge the risks inherent in blockchain technology and
                cryptocurrency transactions.
              </p>
              <p>
                We are not responsible for losses due to smart contract bugs,
                blockchain network issues, or market volatility.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                9
              </span>
              Limitation of Liability
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p className="font-semibold">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW:
              </p>
              <p>
                We are not liable for any direct, indirect, incidental,
                consequential, or punitive damages arising from your use of the
                service.
              </p>
              <p>
                This includes but is not limited to: loss of funds, loss of
                NFTs, loss of profits, data loss, or service interruptions.
              </p>
              <p>
                Our total liability shall not exceed the fees you paid to us in
                the 12 months prior to the claim.
              </p>
              <p>
                Some jurisdictions do not allow limitations on liability, so
                these limitations may not apply to you.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                10
              </span>
              Disclaimer of Warranties
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
                WARRANTIES OF ANY KIND.
              </p>
              <p>
                We do not guarantee uninterrupted, error-free, or secure
                service.
              </p>
              <p>
                We make no warranties regarding the accuracy, reliability, or
                completeness of any content.
              </p>
              <p>
                We do not endorse or verify the authenticity of any NFTs gifted
                through the platform.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                11
              </span>
              Indemnification
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p>
                You agree to indemnify and hold harmless the platform, its
                operators, and affiliates from any claims, damages, or expenses
                arising from:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Your violation of these terms</li>
                <li>Your violation of any law or third-party rights</li>
                <li>Your use of the service</li>
                <li>NFTs you gift or receive through the platform</li>
              </ul>
            </div>
          </section>

          {/* Section 12 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                12
              </span>
              Termination
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p>
                We reserve the right to suspend or terminate your access to the
                service at any time for any reason.
              </p>
              <p>You may stop using the service at any time.</p>
              <p>
                Active gifts in escrow will remain accessible even after account
                termination.
              </p>
              <p>
                Provisions regarding liability, indemnification, and dispute
                resolution survive termination.
              </p>
            </div>
          </section>

          {/* Section 13 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                13
              </span>
              Governing Law and Disputes
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p>
                These terms are governed by the laws, without regard to conflict
                of law principles.
              </p>
              <p>
                Any disputes shall be resolved through binding arbitration in
                accordance.
              </p>
              <p>
                You waive any right to participate in class-action lawsuits.
              </p>
              <p>
                If arbitration is not enforceable, disputes will be resolved in
                the courts of India.
              </p>
            </div>
          </section>

          {/* Section 14 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                14
              </span>
              Privacy
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p>
                Your use of the service is also governed by our Privacy Policy.
              </p>
              <p>
                We collect minimal personal data necessary to operate the
                service.
              </p>
              <p>Blockchain transactions are public and permanent by nature.</p>
              <p>We do not sell your personal information to third parties.</p>
            </div>
          </section>

          {/* Section 15 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                15
              </span>
              Tax Obligations
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p>
                You are solely responsible for determining and paying any taxes
                applicable to your transactions.
              </p>
              <p>
                Gifting and receiving NFTs or cryptocurrency may have tax
                implications in your jurisdiction.
              </p>
              <p>
                We do not provide tax advice. Consult a tax professional for
                guidance.
              </p>
              <p>
                We may report transaction information to tax authorities as
                required by law.
              </p>
            </div>
          </section>

          {/* Section 16 */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                16
              </span>
              Miscellaneous
            </h2>
            <div className="pl-10 space-y-3 text-slate-700">
              <p>
                <strong>Severability:</strong> If any provision is found
                unenforceable, the remaining provisions remain in effect.
              </p>
              <p>
                <strong>No Waiver:</strong> Our failure to enforce any right
                does not waive that right.
              </p>
              <p>
                <strong>Assignment:</strong> You may not assign these terms. We
                may assign our rights to any successor.
              </p>
              <p>
                <strong>Entire Agreement:</strong> These terms constitute the
                entire agreement between you and us regarding the service.
              </p>
              <p>
                <strong>Force Majeure:</strong> We are not liable for delays or
                failures due to circumstances beyond our control.
              </p>
            </div>
          </section>

          {/* Contact Section */}
          <section className="mt-12 pt-8 border-t border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              Contact Us
            </h2>
            <div className="bg-slate-50 rounded-lg p-6 space-y-2 text-slate-700">
              <p>
                If you have questions about these Terms and Conditions, please
                contact us:
              </p>
              <p className="font-semibold text-slate-900">
                Email:{" "}
                <span className="text-indigo-600">wmano038@gmail.com</span>
              </p>
              <p className="font-semibold text-slate-900">
                Address: <span className="text-slate-700">Memento</span>
              </p>
            </div>
          </section>

          {/* Acknowledgment */}
          <section className="mt-8 p-6 bg-indigo-50 border border-indigo-200 rounded-lg">
            <p className="text-sm text-indigo-900 font-medium">
              ✓ By using our service, you acknowledge that you have read,
              understood, and agree to be bound by these Terms and Conditions.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-slate-500">
          <p>© 2026 Memento. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
