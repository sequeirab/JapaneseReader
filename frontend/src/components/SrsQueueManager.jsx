import React, { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function SrsQueueManager() {
  const [queue, setQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sortBy, setSortBy] = useState('due_date');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [removingKanji, setRemovingKanji] = useState(null);

  const getAuthToken = () => {
    const token = localStorage.getItem('authToken');
    return import.meta.env.DEV && !token ? 'dev-dummy-token' : token;
  };

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    const token = getAuthToken();
    
    if (!token && !import.meta.env.DEV) {
      setMessage('Error: Not logged in. Please log in to view your queue.');
      setIsLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        sortBy,
        order: sortOrder
      });

      const response = await fetch(`${API_BASE_URL}/api/srs/queue?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }

      setQueue(data.queue || []);
      setMessage('');
    } catch (err) {
      console.error('Error fetching queue:', err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, sortOrder]);

  const removeKanji = async (kanji) => {
    setRemovingKanji(kanji);
    const token = getAuthToken();

    try {
      const response = await fetch(`${API_BASE_URL}/api/srs/remove/${encodeURIComponent(kanji)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }

      // Remove from local state with animation
      setQueue(prev => prev.filter(card => card.kanji_character !== kanji));
      setMessage(`Successfully removed ${kanji} from your collection`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error removing kanji:', err);
      setMessage(`Error removing ${kanji}: ${err.message}`);
    } finally {
      setRemovingKanji(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMs <= 0) return { text: 'Due now', color: 'text-red-600', bg: 'bg-red-50 border-red-200' };
    if (diffDays === 1) return { text: 'Tomorrow', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' };
    if (diffDays <= 7) return { text: `${diffDays}d`, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' };
    if (diffDays <= 30) return { text: `${diffDays}d`, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' };
    return { text: `${diffDays}d`, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
  };

  const getEfficiencyColor = (efactor) => {
    if (efactor >= 2.5) return 'text-emerald-600 bg-emerald-50';
    if (efactor >= 2.0) return 'text-blue-600 bg-blue-50';
    if (efactor >= 1.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const sortOptions = [
    { value: 'due_date', label: '📅 Due Date', icon: '📅' },
    { value: 'created_at', label: '➕ Date Added', icon: '➕' },
    { value: 'last_reviewed_at', label: '👀 Last Reviewed', icon: '👀' },
    { value: 'repetition', label: '🔄 Repetitions', icon: '🔄' },
    { value: 'efactor', label: '⚡ Ease Factor', icon: '⚡' },
    { value: 'kanji_character', label: '🔤 Character', icon: '🔤' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex justify-center items-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-pink-400 rounded-full animate-spin animation-delay-150 mx-auto"></div>
          </div>
          <h3 className="text-xl font-semibold text-slate-700 mb-2">Loading your collection...</h3>
          <p className="text-slate-500">Organizing your kanji library</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          漢字コレクション
        </h1>
        <p className="text-slate-600 text-lg">Your Kanji Collection Manager</p>
      </div>

      {/* Controls */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-lg">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-slate-700">Sort by:</label>
              <div className="relative">
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none bg-white/80 border border-slate-300 rounded-xl px-4 py-2 pr-8 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-slate-700">Order:</label>
              <div className="flex bg-slate-100 rounded-xl p-1">
                <button
                  onClick={() => setSortOrder('ASC')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                    sortOrder === 'ASC' 
                      ? 'bg-white text-purple-600 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  ↑ Asc
                </button>
                <button
                  onClick={() => setSortOrder('DESC')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                    sortOrder === 'DESC' 
                      ? 'bg-white text-purple-600 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  ↓ Desc
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-600 bg-slate-100 px-3 py-2 rounded-lg">
              📚 {queue.length} kanji
            </div>
            <button 
              onClick={fetchQueue}
              className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-all duration-200 hover:scale-105"
              title="Refresh"
            >
              🔄
            </button>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-2xl p-4 border transition-all duration-300 ${
          message.startsWith('Error:') 
            ? 'bg-red-50/90 text-red-700 border-red-200' 
            : 'bg-emerald-50/90 text-emerald-700 border-emerald-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{message.startsWith('Error:') ? '⚠️' : '✅'}</span>
            <span className="font-medium">{message}</span>
          </div>
        </div>
      )}

      {/* Queue Display */}
      {queue.length === 0 ? (
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-12 border border-white/30 shadow-lg text-center">
          <div className="text-8xl mb-6">📚</div>
          <h3 className="text-2xl font-bold text-slate-700 mb-3">Your collection is empty</h3>
          <p className="text-slate-500 mb-4">Start adding kanji from the text reader to build your learning library!</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-xl text-sm">
            💡 Tip: Process some Japanese text to discover new kanji
          </div>
        </div>
      ) : (
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/30 shadow-lg overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Kanji</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Progress</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Performance</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Timeline</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.map((card, index) => {
                  const dueInfo = formatDate(card.due_date);
                  return (
                    <tr key={index} className="hover:bg-slate-50/50 transition-all duration-200 group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl font-bold bg-gradient-to-br from-slate-100 to-slate-200 p-3 rounded-xl border border-slate-300 group-hover:scale-105 transition-transform duration-200">
                            {card.kanji_character}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${dueInfo.bg} ${dueInfo.color}`}>
                          {dueInfo.text}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Rep:</span>
                            <span className="font-semibold text-slate-700">{card.repetition}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Interval:</span>
                            <span className="font-medium text-slate-600">{card.interval}d</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold ${getEfficiencyColor(card.efactor)}`}>
                          ⚡ {parseFloat(card.efactor).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 text-xs text-slate-500">
                          <div>Added: {new Date(card.created_at).toLocaleDateString()}</div>
                          <div>
                            Last: {card.last_reviewed_at ? new Date(card.last_reviewed_at).toLocaleDateString() : 'Never'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => removeKanji(card.kanji_character)}
                          disabled={removingKanji === card.kanji_character}
                          className={`transition-all duration-200 px-3 py-2 rounded-xl text-sm font-medium ${
                            removingKanji === card.kanji_character
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-red-500 hover:bg-red-600 text-white hover:scale-105 shadow-lg hover:shadow-red-500/25'
                          }`}
                        >
                          {removingKanji === card.kanji_character ? '⏳' : '🗑️'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4 p-4">
            {queue.map((card, index) => {
              const dueInfo = formatDate(card.due_date);
              return (
                <div key={index} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-4xl font-bold bg-gradient-to-br from-slate-100 to-slate-200 p-4 rounded-xl border border-slate-300">
                      {card.kanji_character}
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${dueInfo.bg} ${dueInfo.color}`}>
                        {dueInfo.text}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Repetitions:</span>
                        <span className="font-semibold text-slate-700">{card.repetition}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Interval:</span>
                        <span className="font-medium text-slate-600">{card.interval}d</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Ease Factor:</span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getEfficiencyColor(card.efactor)}`}>
                          {parseFloat(card.efactor).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Last Review:</span>
                        <span className="text-xs text-slate-600">
                          {card.last_reviewed_at ? new Date(card.last_reviewed_at).toLocaleDateString() : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => removeKanji(card.kanji_character)}
                    disabled={removingKanji === card.kanji_character}
                    className={`w-full transition-all duration-200 px-4 py-2 rounded-xl text-sm font-medium ${
                      removingKanji === card.kanji_character
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    {removingKanji === card.kanji_character ? '⏳ Removing...' : '🗑️ Remove from Collection'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SrsQueueManager;