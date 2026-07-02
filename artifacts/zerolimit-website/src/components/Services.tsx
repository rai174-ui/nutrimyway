import { Smartphone, Cloud, Code, Palette, Database, Shield } from "lucide-react";

export default function Services() {
  const services = [
    {
      icon: Smartphone,
      title: "Mobile App Development",
      description: "Native and cross-platform mobile apps built with React Native, Capacitor, and modern frameworks. From concept to App Store.",
    },
    {
      icon: Cloud,
      title: "Web Application Development",
      description: "Progressive web apps and responsive websites with React, Vite, and modern backend technologies. Fast, secure, scalable.",
    },
    {
      icon: Code,
      title: "API & Backend Development",
      description: "RESTful APIs, database design, and server architecture. Built with Node.js, PostgreSQL, and cloud infrastructure.",
    },
    {
      icon: Palette,
      title: "UI/UX Design",
      description: "User-centered design that converts. Wireframes, prototypes, and pixel-perfect interfaces that users love.",
    },
    {
      icon: Database,
      title: "Database & Analytics",
      description: "Data architecture, reporting dashboards, and analytics integration. Turn your data into actionable insights.",
    },
    {
      icon: Shield,
      title: "DevOps & Deployment",
      description: "CI/CD pipelines, cloud deployment, and infrastructure management. We handle the technical complexity so you don't have to.",
    },
  ];

  return (
    <section id="services" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-[#0d7377] text-sm font-semibold uppercase tracking-wider">
            Our Services
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
            End-to-End Digital
            <br />
            <span className="text-[#0d7377]">Solution Delivery</span>
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            From ideation to deployment, we handle every aspect of building your digital product.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service) => (
            <div
              key={service.title}
              className="group p-8 rounded-2xl border border-gray-100 hover:border-[#0d7377]/20 hover:shadow-lg transition-all hover:-translate-y-1 bg-gray-50/50"
            >
              <div className="w-14 h-14 bg-[#0d7377] rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <service.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {service.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
