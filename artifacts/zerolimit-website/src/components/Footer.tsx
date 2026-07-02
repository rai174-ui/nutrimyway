import { Heart } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#1a1a2e] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <img
                src="/zerolimit-logo.png"
                alt="Zero Limit Automation"
                className="h-10 w-auto"
              />
              <span className="text-xl font-bold">Zero Limit Automation</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-md">
              Building intelligent digital products for health, wellness, and automation.
              We transform ideas into powerful, user-friendly applications.
            </p>
            <div className="mt-4 flex items-center space-x-2 text-sm text-gray-500">
              <Heart className="w-4 h-4 text-[#0d7377]" />
              <span>Made with care in India</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <a href="#about" className="text-gray-400 hover:text-[#0d7377] transition-colors text-sm">
                  About Us
                </a>
              </li>
              <li>
                <a href="#services" className="text-gray-400 hover:text-[#0d7377] transition-colors text-sm">
                  Services
                </a>
              </li>
              <li>
                <a href="#products" className="text-gray-400 hover:text-[#0d7377] transition-colors text-sm">
                  Products
                </a>
              </li>
              <li>
                <a href="#contact" className="text-gray-400 hover:text-[#0d7377] transition-colors text-sm">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a href="/privacy" className="text-gray-400 hover:text-[#0d7377] transition-colors text-sm">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#contact" className="text-gray-400 hover:text-[#0d7377] transition-colors text-sm">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-semibold text-white mb-4">Products</h4>
            <ul className="space-y-2">
              <li>
                <a href="#products" className="text-gray-400 hover:text-[#0d7377] transition-colors text-sm">
                  NutriMyWay
                </a>
              </li>
              <li>
                <span className="text-gray-500 text-sm italic">More coming soon...</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            {currentYear} Zero Limit Automation. All rights reserved.
          </p>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>Powered by</span>
            <span className="font-semibold text-[#0d7377]">Zero Limit Automation</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
