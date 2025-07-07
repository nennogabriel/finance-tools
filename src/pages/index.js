import Link from 'next/link';
import { FileText, Activity, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 text-gray-800">
      <main className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">
            Finance Tools
          </h1>
          <p className="mt-4 text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            Simulate and analyze your investments with a powerful and intuitive set of tools.
          </p>
        </div>

        <div className="mt-12 p-6 bg-yellow-100 border-l-4 border-yellow-500 rounded-r-lg max-w-3xl mx-auto">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-yellow-600 mr-4" />
            <div>
              <h2 className="text-xl font-semibold text-yellow-800">Important Disclaimer</h2>
              <p className="mt-2 text-yellow-700">
                This entire website is an experiment and is under construction. Do not make any investment decisions without seeking guidance from a qualified professional.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-700 mb-8">Our Tools</h2>
          <div className="grid md:grid-cols-1 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300">
              <div className="flex items-start">
                <div className="p-3 bg-indigo-100 rounded-full mr-6">
                  <Activity className="h-8 w-8 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Portfolio Simulator</h3>
                  <p className="mt-2 text-gray-600">
                    Project the future of your portfolio based on various economic scenarios, contributions, and withdrawal strategies. Understand the potential growth and risks involved.
                  </p>
                  <Link href="/tools/portfolio-simulator" className="inline-block mt-6 bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors duration-300">
                    Go to Simulator
                  </Link>
                </div>
              </div>
            </div>
            {/* You can add more cards here for future tools */}
          </div>
        </div>

      </main>
    </div>
  );
}
