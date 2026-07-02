import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center">
          <a
            href="/zerolimit/"
            className="flex items-center space-x-2 text-[#0d7377] hover:text-[#0a5c5f] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Home</span>
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12">
          {/* Title */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-[#0d7377]/10 rounded-xl mb-4">
              <Shield className="w-7 h-7 text-[#0d7377]" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Privacy Policy
            </h1>
            <p className="text-gray-500">Zero Limit Automation &mdash; NutriMyWay</p>
          </div>

          {/* Effective Date */}
          <div className="bg-[#0d7377]/5 border-l-4 border-[#0d7377] rounded-r-lg p-4 mb-8">
            <p className="text-sm text-gray-700">
              <strong>Effective Date:</strong> July 2, 2026<br />
              <strong>Last Updated:</strong> July 2, 2026
            </p>
          </div>

          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 leading-relaxed">
              Zero Limit Automation (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates the NutriMyWay mobile application (the &ldquo;App&rdquo;). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our App.
            </p>

            <p className="text-gray-600 leading-relaxed">
              By using NutriMyWay, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with our policies and practices, please do not use the App.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. Information We Collect</h2>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">1.1 Personal Information</h3>
            <p className="text-gray-600 leading-relaxed mb-3">When you register or use NutriMyWay, we may collect:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Name and contact information:</strong> Your name, email address, and phone number</li>
              <li><strong>Profile information:</strong> Age, gender, height, weight, and health goals</li>
              <li><strong>Center membership details:</strong> Your wellness center affiliation and membership ID</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">1.2 Health and Nutrition Data</h3>
            <p className="text-gray-600 leading-relaxed mb-3">As a health tracking application, we collect data you voluntarily enter:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Meal logs:</strong> Foods consumed, portion sizes, meal times, and photos of meals</li>
              <li><strong>Nutritional data:</strong> Calories, macronutrients (protein, carbohydrates, fats), and micronutrients</li>
              <li><strong>Weight records:</strong> Weight measurements and timestamps</li>
              <li><strong>Health metrics:</strong> BMI, body measurements, and other wellness metrics tracked at your center</li>
              <li><strong>Nutrition plans:</strong> Assigned meal plans, target calorie goals, and plan progress</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">1.3 Device and Technical Information</h3>
            <p className="text-gray-600 leading-relaxed mb-3">We automatically collect:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Device type and operating system version</li>
              <li>App version and usage statistics</li>
              <li>Push notification tokens (for sending you meal reminders and updates)</li>
              <li>IP address and general location (city/region level, not precise GPS)</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">1.4 Camera and Photos</h3>
            <p className="text-gray-600 leading-relaxed mb-3">NutriMyWay allows you to take photos of your meals for logging purposes. These photos are:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Stored securely on our servers</li>
              <li>Associated with your account and meal records</li>
              <li>Used solely for your personal meal tracking and nutrition analysis</li>
              <li>Never shared with third parties without your explicit consent</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. How We Use Your Information</h2>
            <p className="text-gray-600 leading-relaxed mb-3">We use the collected information for the following purposes:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Provide core services:</strong> Meal logging, calorie tracking, macro analysis, and nutrition plan monitoring</li>
              <li><strong>Personalize experience:</strong> Customize your dashboard, nutrition targets, and recommendations</li>
              <li><strong>Push notifications:</strong> Send meal reminders, plan updates, and wellness center notifications</li>
              <li><strong>Analytics and improvement:</strong> Understand app usage to improve features and performance</li>
              <li><strong>Center coordination:</strong> Share relevant health data with your registered wellness center (only with your consent)</li>
              <li><strong>Security:</strong> Protect against fraud, abuse, and unauthorized access</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. Data Sharing and Disclosure</h2>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">3.1 With Your Wellness Center</h3>
            <p className="text-gray-600 leading-relaxed mb-3">If you are affiliated with a wellness center through NutriMyWay:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Your center administrators can view your meal logs, weight trends, and health metrics</li>
              <li>Center staff can assign nutrition plans and monitor your progress</li>
              <li>This sharing is essential for the center-managed nutrition program</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">3.2 Service Providers</h3>
            <p className="text-gray-600 leading-relaxed mb-3">We use trusted third-party services to operate NutriMyWay:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Firebase Cloud Messaging (Google):</strong> For delivering push notifications to your device</li>
              <li><strong>Hosting providers:</strong> For secure data storage and app backend services</li>
              <li><strong>Analytics providers:</strong> For understanding app usage (anonymized data only)</li>
            </ul>
            <p className="text-gray-600 leading-relaxed">These providers are contractually bound to protect your data and use it only for the services we request.</p>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">3.3 Legal Requirements</h3>
            <p className="text-gray-600 leading-relaxed mb-3">We may disclose your information if required by:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Valid legal process (court order, subpoena)</li>
              <li>Protection of our rights, property, or safety</li>
              <li>Investigation of potential fraud or security incidents</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">3.4 Business Transfers</h3>
            <p className="text-gray-600 leading-relaxed">If Zero Limit Automation is involved in a merger, acquisition, or asset sale, your information may be transferred as part of that transaction. We will notify you before your information is transferred and becomes subject to a different privacy policy.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">4. Data Security</h2>
            <p className="text-gray-600 leading-relaxed mb-3">We implement industry-standard security measures to protect your data:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Encryption:</strong> All data transmitted between the app and our servers uses TLS/SSL encryption</li>
              <li><strong>Secure storage:</strong> Data is stored in encrypted databases with access controls</li>
              <li><strong>Authentication:</strong> Secure login mechanisms protect your account</li>
              <li><strong>Regular audits:</strong> We conduct security reviews and vulnerability assessments</li>
            </ul>
            <p className="text-gray-600 leading-relaxed">However, no method of electronic storage or transmission is 100% secure. While we strive to protect your personal information, we cannot guarantee absolute security.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">5. Data Retention</h2>
            <p className="text-gray-600 leading-relaxed mb-3">We retain your data for as long as your account is active or as needed to provide you services:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Meal logs and health data: Retained while your account is active</li>
              <li>Inactive accounts: Data may be archived after 12 months of inactivity</li>
              <li>Deleted accounts: Data is permanently removed within 30 days of account deletion request</li>
              <li>Legal obligations: Some data may be retained longer if required by law</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">6. Your Rights and Choices</h2>
            <p className="text-gray-600 leading-relaxed mb-3">Depending on your location, you may have the following rights:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
              <li><strong>Export:</strong> Request your data in a portable format</li>
              <li><strong>Opt-out:</strong> Disable push notifications in your device settings or app preferences</li>
              <li><strong>Withdraw consent:</strong> Stop sharing data with your wellness center (may limit app functionality)</li>
            </ul>
            <p className="text-gray-600 leading-relaxed">To exercise these rights, contact us using the information below.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">7. Children&apos;s Privacy</h2>
            <p className="text-gray-600 leading-relaxed">NutriMyWay is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">8. International Data Transfers</h2>
            <p className="text-gray-600 leading-relaxed">Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. We ensure appropriate safeguards are in place for such transfers.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">9. Changes to This Privacy Policy</h2>
            <p className="text-gray-600 leading-relaxed mb-3">We may update this Privacy Policy from time to time. We will notify you of any changes by:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Posting the new Privacy Policy on this page</li>
              <li>Updating the &ldquo;Last Updated&rdquo; date</li>
              <li>Sending a notification through the app for significant changes</li>
            </ul>
            <p className="text-gray-600 leading-relaxed">Your continued use of the App after changes constitutes acceptance of the revised policy.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">10. Push Notifications</h2>
            <p className="text-gray-600 leading-relaxed mb-3">NutriMyWay uses push notifications to send you:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Meal logging reminders</li>
              <li>Nutrition plan updates</li>
              <li>Wellness center announcements</li>
              <li>App updates and feature announcements</li>
            </ul>
            <p className="text-gray-600 leading-relaxed">You can disable push notifications at any time through your device settings or within the app&apos;s notification preferences.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">11. Camera and Photo Permissions</h2>
            <p className="text-gray-600 leading-relaxed mb-3">NutriMyWay requests camera and photo storage permissions to allow you to:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Take photos of meals for your meal log</li>
              <li>Access photos from your gallery for meal logging</li>
            </ul>
            <p className="text-gray-600 leading-relaxed">These permissions are optional. You can use NutriMyWay without granting camera access, but you won&apos;t be able to attach photos to meal entries.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">12. Cookies and Tracking</h2>
            <p className="text-gray-600 leading-relaxed">NutriMyWay does not use cookies. However, our website and third-party analytics services may use cookies or similar technologies for session management and usage analytics.</p>

            {/* Contact Box */}
            <div className="bg-[#0d7377]/5 rounded-xl p-6 mt-10 border border-[#0d7377]/10">
              <h2 className="text-xl font-bold text-gray-900 mb-3">Contact Us</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                If you have questions about this Privacy Policy or your data, please contact:
              </p>
              <div className="text-gray-700">
                <p className="font-semibold text-gray-900">Zero Limit Automation</p>
                <p>Email: <a href="mailto:privacy@zerolimitautomation.com" className="text-[#0d7377] hover:underline">privacy@zerolimitautomation.com</a></p>
                <p>Address: New Delhi, India</p>
                <p>Phone: +91 99999 99999</p>
              </div>
              <p className="text-gray-500 text-sm mt-4">We will respond to your inquiry within 30 days.</p>
            </div>

            <p className="text-center text-gray-500 text-sm mt-10">
              NutriMyWay is a product of Zero Limit Automation. All rights reserved.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a1a2e] text-white py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center space-x-3 mb-3">
            <img
              src="/zerolimit/zerolimit-logo.png"
              alt="Zero Limit Automation"
              className="h-8 w-auto"
            />
            <span className="font-bold">Zero Limit Automation</span>
          </div>
          <p className="text-gray-400 text-sm">
            {new Date().getFullYear()} Zero Limit Automation. All rights reserved.
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Powered by <span className="text-[#0d7377] font-semibold">Zero Limit Automation</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
