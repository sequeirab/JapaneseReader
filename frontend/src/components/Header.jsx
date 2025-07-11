// src/components/Header.jsx
import React from 'react';

function Header() {
  return (
    <header className="text-center mb-8 relative">
      {/* Decorative Elements */}
      <div className="absolute -top-2 -left-2 w-8 h-8 bg-gradient-to-br from-red-400/20 to-pink-400/20 rounded-full blur-xl animate-pulse"></div>
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-lg animate-pulse delay-1000"></div>
      
      <div className="relative inline-block group">
        {/* Main Title */}
        <div className="mb-3">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2 transition-all duration-500 group-hover:scale-105">
            日本語リーダー
          </h1>
          <div className="text-lg sm:text-xl text-slate-600 font-medium tracking-wide">
            Japanese Reader
          </div>
        </div>

        {/* Subtitle with Japanese styling */}
        <div className="flex items-center justify-center gap-3 text-slate-500 text-sm">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-slate-300"></div>
          <span className="px-3 py-1 bg-slate-100/80 rounded-full border border-slate-200/80 backdrop-blur-sm">
            ✨ Master Kanji with SRS
          </span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-slate-300"></div>
        </div>

        {/* Hover Effect Background */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-100/30 via-purple-100/30 to-pink-100/30 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 scale-150"></div>
      </div>

      {/* Traditional Japanese Pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-5">
        <div className="absolute -top-4 left-1/4 w-16 h-16 border-2 border-slate-400 rounded-full"></div>
        <div className="absolute -bottom-2 right-1/4 w-12 h-12 border border-slate-400 rounded-full"></div>
      </div>
    </header>
  );
}

export default Header;
