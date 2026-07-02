import { ArrowRight, Apple, Utensils, Activity, Bell, TrendingUp } from "lucide-react";

export default function Products() {
  return (
    <section id="products" className="py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-[#0d7377] text-sm font-semibold uppercase tracking-wider">
            Our Products
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
            Featured
            <br />
            <span className="text-[#0d7377]">Product Showcase</span>
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Our flagship product built with care for wellness centers and their members.
          </p>
        </div>

        {/* NutriMyWay Product Card */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Product Header */}
            <div className="bg-gradient-to-r from-[#0d7377] to-[#14a085] p-8 sm:p-12">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Apple className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white">NutriMyWay</h3>
                  <p className="text-white/80 text-sm">Nutrition Tracking & Wellness App</p>
                </div>
              </div>
              <p className="text-white/90 text-lg max-w-xl">
                A comprehensive mobile-first nutrition tracking application for wellness center members.
                Track meals, monitor macros, log weight, and follow personalized nutrition plans.
              </p>
            </div>

            {/* Features Grid */}
            <div className="p-8 sm:p-12">
              <h4 className="text-lg font-semibold text-gray-900 mb-6">Key Features</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-[#0d7377]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Utensils className="w-5 h-5 text-[#0d7377]" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900">Meal Logging</h5>
                    <p className="text-sm text-gray-600 mt-1">
                      Log meals with photos, portion sizes, and automatic calorie calculation.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-[#0d7377]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Activity className="w-5 h-5 text-[#0d7377]" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900">Macro Tracking</h5>
                    <p className="text-sm text-gray-600 mt-1">
                      Monitor protein, carbs, fats, and micronutrients with visual progress indicators.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-[#0d7377]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-[#0d7377]" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900">Weight Trends</h5>
                    <p className="text-sm text-gray-600 mt-1">
                      Track weight changes over time with beautiful charts and goal setting.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-[#0d7377]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bell className="w-5 h-5 text-[#0d7377]" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900">Push Notifications</h5>
                    <p className="text-sm text-gray-600 mt-1">
                      Get reminded about meal logging and receive updates from your wellness center.
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="mt-8 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-500">
                  Available on Google Play Store
                </div>
                <a
                  href="#contact"
                  className="group inline-flex items-center space-x-2 px-6 py-3 bg-[#0d7377] text-white font-medium rounded-xl hover:bg-[#0a5c5f] transition-colors"
                >
                  <span>Learn More</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* More Products Coming */}
        <div className="mt-12 text-center">
          <p className="text-gray-500">
            More products in development. Stay tuned for updates.
          </p>
        </div>
      </div>
    </section>
  );
}
