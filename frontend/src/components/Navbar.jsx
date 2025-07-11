import React from 'react';
import { BookOpenText, Repeat, LogOut } from 'lucide-react';

// Modern Japanese-themed Navbar component
function Navbar({ activeView, setActiveView, handleLogout }) {
  const navItems = [
    { 
      key: 'reader', 
      icon: BookOpenText, 
      label: 'テキスト', 
      englishLabel: 'Reader',
      gradient: 'from-blue-500 to-indigo-600',
      shadow: 'shadow-blue-500/25'
    },
    { 
      key: 'srs', 
      icon: Repeat, 
      label: 'SRS復習', 
      englishLabel: 'Review',
      gradient: 'from-emerald-500 to-teal-600',
      shadow: 'shadow-emerald-500/25'
    }
  ];

  return (
    <nav className="w-full bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/30 p-2 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-50/30 via-purple-50/30 to-pink-50/30 rounded-2xl"></div>
      
      <div className="relative flex justify-between items-center">
        {/* Left side: View Navigation */}
        <div className="flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;
            
            return (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className={`group relative flex items-center gap-3 px-6 py-3 rounded-xl font-medium transition-all duration-300 transform ${
                  isActive
                    ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg ${item.shadow} scale-105`
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50 hover:scale-105'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={18} className={`transition-transform duration-300 ${isActive ? 'rotate-12' : 'group-hover:rotate-6'}`} />
                <div className="flex flex-col items-start">
                  <span className={`text-sm font-bold ${isActive ? 'text-white' : 'text-slate-700'}`}>
                    {item.label}
                  </span>
                  <span className={`text-xs ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                    {item.englishLabel}
                  </span>
                </div>
                
                {/* Hover effect background */}
                {!isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-100/50 to-slate-200/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                )}
              </button>
            );
          })}
        </div>

        {/* Right side: User Actions */}
        <div className="flex items-center gap-3">
          {/* User indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-100/80 rounded-xl border border-slate-200/80">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-slate-600 font-medium">Online</span>
          </div>
          
          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="group relative flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-red-500/25 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          >
            <LogOut size={16} className="transition-transform duration-300 group-hover:-rotate-12" />
            <span className="hidden sm:inline text-sm">ログアウト</span>
            <span className="sm:hidden text-sm">Exit</span>
            
            {/* Hover effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
