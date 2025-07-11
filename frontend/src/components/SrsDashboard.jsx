import React, { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function SrsDashboard({ onNavigateToReview }) {
  const [stats, setStats] = useState(null);
  const [dueCards, setDueCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  const getAuthToken = () => {
    const token = localStorage.getItem('authToken');
    return import.meta.env.DEV && !token ? 'dev-dummy-token' : token;
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const token = getAuthToken();
    
    if (!token && !import.meta.env.DEV) {
      setMessage('Error: Not logged in. Please log in to view your dashboard.');
      setIsLoading(false);
      return;
    }

    try {
      // Fetch stats and due cards in parallel
      const [statsResponse, dueResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/srs/stats`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/srs/due`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
      ]);

      const [statsData, dueData] = await Promise.all([
        statsResponse.json(),
        dueResponse.json()
      ]);

      if (!statsResponse.ok) {
        throw new Error(statsData.error || `Stats error! Status: ${statsResponse.status}`);
      }
      if (!dueResponse.ok) {
        throw new Error(dueData.error || `Due cards error! Status: ${dueResponse.status}`);
      }

      setStats(statsData.stats);
      setDueCards(dueData.dueCards || []);
      setMessage('');
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getNextReviewTime = (dateString) => {
    const now = new Date();
    const due = new Date(dateString);
    const diffMs = due - now;
    
    if (diffMs <= 0) return 'Due now';
    if (diffMs < 3600000) return `Due in ${Math.ceil(diffMs / 60000)}m`;
    if (diffMs < 86400000) return `Due in ${Math.ceil(diffMs / 3600000)}h`;
    
    const diffDays = Math.ceil(diffMs / 86400000);
    return `Due in ${diffDays}d`;
  };

  const StatCard = ({ title, value, subtitle, icon, gradient, textColor }) => (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl group`}>
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-16 w-16 rounded-full bg-white/10 transition-all duration-300 group-hover:scale-150"></div>
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <h3 className={`text-sm font-medium ${textColor}/80`}>{title}</h3>
          <span className="text-2xl">{icon}</span>
        </div>
        <div className={`text-3xl font-bold ${textColor} mb-1`}>{value}</div>
        {subtitle && <div className={`text-xs ${textColor}/70`}>{subtitle}</div>}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-400 rounded-full animate-spin animation-delay-150"></div>
        </div>
      </div>
    );
  }

  if (message.startsWith('Error:')) {
    return (
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 border border-red-200/50 shadow-xl">
        <div className="text-center">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-xl font-semibold text-red-600 mb-2">Oops!</h2>
          <p className="text-red-500">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          学習ダッシュボード
        </h1>
        <p className="text-slate-600 text-lg">Your Japanese Learning Dashboard</p>
      </div>
      
      {/* Main Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Kanji"
          value={stats?.totalCards || 0}
          icon="📚"
          gradient="from-blue-500 to-cyan-500"
          textColor="text-white"
        />
        
        <StatCard
          title="Due Today"
          value={stats?.dueToday || 0}
          subtitle={stats?.dueToday > 0 ? "Ready to review!" : "All caught up!"}
          icon="🎯"
          gradient="from-emerald-500 to-teal-500"
          textColor="text-white"
        />
        
        <StatCard
          title="This Week"
          value={stats?.dueThisWeek || 0}
          icon="📅"
          gradient="from-amber-500 to-orange-500"
          textColor="text-white"
        />
        
        <StatCard
          title="Studied Today"
          value={stats?.reviewedToday || 0}
          subtitle={stats?.reviewedToday > 0 ? "Great progress!" : "Start studying!"}
          icon="✨"
          gradient="from-purple-500 to-pink-500"
          textColor="text-white"
        />
      </div>

      {/* Detailed Progress Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Learning Progress */}
        <div className="lg:col-span-1">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              📈 Learning Progress
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-600">Total Reviewed:</span>
                <span className="font-semibold text-slate-800">{stats?.reviewedCards || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-600">Never Reviewed:</span>
                <span className="font-semibold text-slate-800">{(stats?.totalCards || 0) - (stats?.reviewedCards || 0)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-600">Avg. Ease Factor:</span>
                <span className="font-semibold text-slate-800">{stats?.avgEfactor?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-600">Max Repetitions:</span>
                <span className="font-semibold text-slate-800">{stats?.maxRepetition || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Due Cards Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                🎴 Ready for Review
              </h3>
              <button 
                onClick={fetchData}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all duration-200"
                title="Refresh"
              >
                🔄
              </button>
            </div>
            
            {dueCards.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🌸</div>
                <h4 className="text-xl font-semibold text-slate-700 mb-2">All caught up!</h4>
                <p className="text-slate-500">No cards due for review right now.</p>
                <p className="text-sm text-slate-400 mt-2">Check back later or add more kanji to your collection.</p>
              </div>
            ) : (
              <>
                <p className="text-slate-600 mb-4">
                  {dueCards.length} card{dueCards.length !== 1 ? 's' : ''} waiting for your attention
                </p>
                
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
                  {dueCards.slice(0, 12).map((card, index) => (
                    <div 
                      key={index}
                      className="group relative bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200 text-center hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer"
                      onClick={onNavigateToReview}
                    >
                      <div className="text-3xl font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                        {card.kanji_character}
                      </div>
                      <div className="text-xs text-slate-500">
                        Rep: {card.repetition}
                      </div>
                      <div className="text-xs text-emerald-600 font-medium">
                        {getNextReviewTime(card.due_date)}
                      </div>
                      
                      {/* Hover effect */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                  ))}
                </div>
                
                {dueCards.length > 12 && (
                  <p className="text-sm text-slate-500 text-center">
                    And {dueCards.length - 12} more kanji waiting...
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button 
          onClick={onNavigateToReview}
          disabled={dueCards.length === 0}
          className={`group relative px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 ${
            dueCards.length === 0 
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30'
          }`}
        >
          <span className="relative z-10 flex items-center gap-3">
            🎯 Start Review Session
            {dueCards.length > 0 && (
              <span className="bg-white/20 px-2 py-1 rounded-full text-sm">
                {dueCards.length}
              </span>
            )}
          </span>
          {dueCards.length > 0 && (
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          )}
        </button>
        
        <button 
          onClick={fetchData}
          className="group relative px-8 py-4 bg-white/90 backdrop-blur-xl border border-white/20 text-slate-700 rounded-2xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
        >
          <span className="flex items-center gap-2">
            🔄 Refresh Data
          </span>
        </button>
      </div>
    </div>
  );
}

export default SrsDashboard;