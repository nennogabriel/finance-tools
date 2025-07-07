import Link from 'next/link';
import { Home } from 'lucide-react';

const Header = () => {
  return (
    <header className="bg-white shadow-md">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-indigo-600 hover:text-indigo-800">
              Finance Tools
            </Link>
          </div>
          <div className="flex items-center">
            <Link href="/" className="flex items-center text-gray-600 hover:text-indigo-600 p-2 rounded-md transition-colors">
              <Home className="h-5 w-5 mr-2" />
              <span>Home</span>
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header; 