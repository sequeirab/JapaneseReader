import React from 'react';
import { BookOpenText, Repeat } from 'lucide-react'; // Icons for navigation

// Simple Navbar component
function Navbar({ activeView, setActiveView, handleLogout }) {

  // Helper function to get button classes based on active state
  const getButtonClasses = (viewName) => {
    const baseClasses = "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-500";
    if (activeView === viewName) {
      // Active button style
      return `${baseClasses} bg-orange-100 text-orange-700 border border-orange-200 shadow-sm`;
    } else {
      // Inactive button style
      return `${baseClasses} text-stone-600 hover:bg-stone-100 hover:text-stone-800 border border-transparent`;
    }
  };

  return (
    <nav className="w-full max-w-4xl bg-white/70 backdrop-blur-sm rounded-lg shadow-sm p-3 mb-6 border border-stone-300/30">
      <div className="flex justify-between items-center">
        {/* Left side: View Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('reader')}
            className={getButtonClasses('reader')}
            aria-current={activeView === 'reader' ? 'page' : undefined}
          >
            <BookOpenText size={16} />
            Reader
          </button>
          <button
            onClick={() => setActiveView('srs')}
            className={getButtonClasses('srs')}
            aria-current={activeView === 'srs' ? 'page' : undefined}
          >
            <Repeat size={16} />
            SRS Review
          </button>
          {/* Add more navigation buttons here if needed later */}
        </div>

        {/* Right side: Logout Button */}
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
