import { 
  Users, 
  Target, 
  Award, 
  Globe,
  Zap,
  Heart,
  Linkedin,
  Twitter,
  Github
} from 'lucide-react';
import { PublicLayout } from '@/components/Layout';

export default function About() {
  const team = [
    {
      name: "Sarah Johnson",
      role: "CEO & Co-Founder",
      bio: "Former ML engineer at Google with 10+ years in document processing and AI research.",
      image: "/api/placeholder/150/150",
      social: {
        linkedin: "#",
        twitter: "#"
      }
    },
    {
      name: "Michael Chen",
      role: "CTO & Co-Founder",
      bio: "Expert in scalable systems architecture, previously led engineering teams at Dropbox and Uber.",
      image: "/api/placeholder/150/150",
      social: {
        linkedin: "#",
        github: "#"
      }
    },
    {
      name: "Emily Rodriguez",
      role: "Head of Product",
      bio: "Product strategist with deep expertise in B2B SaaS and developer tools.",
      image: "/api/placeholder/150/150",
      social: {
        linkedin: "#",
        twitter: "#"
      }
    },
    {
      name: "David Kim",
      role: "Head of Engineering",
      bio: "Full-stack engineer passionate about building reliable, high-performance systems.",
      image: "/api/placeholder/150/150",
      social: {
        github: "#",
        linkedin: "#"
      }
    }
  ];

  const values = [
    {
      icon: Zap,
      title: "Speed & Efficiency",
      description: "We believe your time is valuable. Our AI processes documents in seconds, not minutes."
    },
    {
      icon: Users,
      title: "Privacy First",
      description: "Your documents are yours. We process them securely and delete them immediately after."
    },
    {
      icon: Heart,
      title: "Developer Focused",
      description: "Built by developers, for developers. Simple APIs, comprehensive docs, and great support."
    },
    {
      icon: Globe,
      title: "Global Accessibility",
      description: "Supporting 100+ languages to make document processing accessible worldwide."
    }
  ];

  const milestones = [
    {
      year: "2022",
      title: "Company Founded",
      description: "Started with a simple idea: make document text extraction fast and reliable."
    },
    {
      year: "2023",
      title: "AI Engine Launch",
      description: "Released our first AI-powered OCR system with 95% accuracy rate."
    },
    {
      year: "2023",
      title: "API Platform",
      description: "Launched developer API platform serving 10,000+ requests daily."
    },
    {
      year: "2024",
      title: "500K Documents",
      description: "Processed over 500,000 documents with 99.5% accuracy rate."
    }
  ];

  return (
    <PublicLayout>
      <div className="bg-white">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl mb-6">
              About PDFtoText
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We're on a mission to make document text extraction fast, accurate, and accessible 
              for developers and businesses worldwide.
            </p>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Mission</h2>
                <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                  We believe that extracting text from documents shouldn't be complicated, slow, or expensive. 
                  Our mission is to provide the most accurate, fastest, and most developer-friendly document 
                  processing platform in the world.
                </p>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Whether you're a startup building your first product or an enterprise processing millions 
                  of documents, we want to make your document workflow seamless and reliable.
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-8">
                <div className="flex items-center mb-6">
                  <Target className="h-8 w-8 text-blue-600 mr-3" />
                  <h3 className="text-2xl font-bold text-gray-900">Our Vision</h3>
                </div>
                <p className="text-gray-600 leading-relaxed">
                  To become the global standard for document text extraction, empowering developers 
                  and businesses to unlock the value in their documents with cutting-edge AI technology.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Our Values
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => {
                const IconComponent = value.icon;
                return (
                  <div key={index} className="bg-white rounded-lg p-6 text-center shadow-sm">
                    <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <IconComponent className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      {value.title}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {value.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Meet Our Team
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {team.map((member, index) => (
                <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                    <Users className="h-16 w-16 text-gray-400" />
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {member.name}
                    </h3>
                    <p className="text-blue-600 text-sm font-medium mb-3">
                      {member.role}
                    </p>
                    <p className="text-gray-600 text-sm mb-4">
                      {member.bio}
                    </p>
                    <div className="flex space-x-2">
                      {member.social.linkedin && (
                        <a href={member.social.linkedin} className="text-gray-400 hover:text-blue-600">
                          <Linkedin className="h-4 w-4" />
                        </a>
                      )}
                      {member.social.twitter && (
                        <a href={member.social.twitter} className="text-gray-400 hover:text-blue-600">
                          <Twitter className="h-4 w-4" />
                        </a>
                      )}
                      {member.social.github && (
                        <a href={member.social.github} className="text-gray-400 hover:text-blue-600">
                          <Github className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Our Journey
            </h2>
            <div className="space-y-8">
              {milestones.map((milestone, index) => (
                <div key={index} className="flex items-start">
                  <div className="flex-shrink-0 bg-blue-600 text-white w-16 h-16 rounded-full flex items-center justify-center font-bold">
                    {milestone.year}
                  </div>
                  <div className="ml-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {milestone.title}
                    </h3>
                    <p className="text-gray-600">
                      {milestone.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Statistics */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              By the Numbers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">500K+</div>
                <div className="text-gray-600">Documents Processed</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">99.5%</div>
                <div className="text-gray-600">Accuracy Rate</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 mb-2">100+</div>
                <div className="text-gray-600">Languages Supported</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-orange-600 mb-2">1,200+</div>
                <div className="text-gray-600">Happy Customers</div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="py-20 bg-blue-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-6">
              Want to Learn More?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              We'd love to hear from you. Get in touch with our team to discuss your document processing needs.
            </p>
            <a 
              href="/contact"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors inline-flex items-center"
            >
              Contact Us
            </a>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}