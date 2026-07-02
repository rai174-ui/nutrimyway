import { Target, Heart, Lightbulb, Users } from "lucide-react";

export default function About() {
  const values = [
    {
      icon: Target,
      title: "Precision",
      description: "We build products with exact attention to detail, ensuring every feature serves a real purpose.",
    },
    {
      icon: Heart,
      title: "User-First",
      description: "Every design decision starts with the user's needs. Simple, intuitive, and accessible interfaces.",
    },
    {
      icon: Lightbulb,
      title: "Innovation",
      description: "We leverage the latest technologies to create solutions that push boundaries.",
    },
    {
      icon: Users,
      title: "Partnership",
      description: "We work closely with wellness centers and businesses as true partners, not just vendors.",
    },
  ];

  return (
    <section id="about" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-[#0d7377] text-sm font-semibold uppercase tracking-wider">
            About Us
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
            Building the Future of
            <br />
            <span className="text-[#0d7377]">Health & Wellness Tech</span>
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Zero Limit Automation is a technology company focused on creating digital solutions
            that empower health and wellness businesses to serve their customers better.
          </p>
        </div>

        {/* Mission Statement */}
        <div className="bg-white rounded-2xl p-8 sm:p-12 shadow-sm border border-gray-100 mb-16">
          <div className="max-w-3xl mx-auto text-center">
            <blockquote className="text-xl sm:text-2xl font-medium text-gray-800 italic leading-relaxed">
              "We believe technology should remove barriers, not create them.
              Our mission is to build tools that make health and wellness
              accessible to everyone, everywhere."
            </blockquote>
            <div className="mt-6 flex items-center justify-center space-x-3">
              <div className="w-10 h-10 bg-[#0d7377] rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">ZL</span>
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Zero Limit Automation</div>
                <div className="text-sm text-gray-500">Founding Team</div>
              </div>
            </div>
          </div>
        </div>

        {/* Core Values */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {values.map((value) => (
            <div
              key={value.title}
              className="group bg-white rounded-xl p-6 border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1"
            >
              <div className="w-12 h-12 bg-[#0d7377]/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-[#0d7377]/20 transition-colors">
                <value.icon className="w-6 h-6 text-[#0d7377]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {value.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
