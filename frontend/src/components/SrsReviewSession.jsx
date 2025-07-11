import React, { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function SrsReviewSession() {
  const [dueCards, setDueCards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [message, setMessage] = useState('');
  const [sessionStats, setSessionStats] = useState({
    total: 0,
    completed: 0,
    correct: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [cardTransition, setCardTransition] = useState('');

  const getAuthToken = () => {
    const token = localStorage.getItem('authToken');
    return import.meta.env.DEV && !token ? 'dev-dummy-token' : token;
  };

  const fetchDueCards = useCallback(async () => {
    setIsLoading(true);
    const token = getAuthToken();
    
    if (!token && !import.meta.env.DEV) {
      setMessage('Error: Not logged in. Please log in to review cards.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/srs/due`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }

      setDueCards(data.dueCards || []);
      setSessionStats(prev => ({ ...prev, total: data.dueCards?.length || 0 }));
      
      if (data.dueCards?.length === 0) {
        setMessage('No cards due for review! Check back later.');
        setSessionComplete(true);
      } else {
        setMessage('');
      }
    } catch (err) {
      console.error('Error fetching due cards:', err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitReview = async (grade) => {
    if (currentCardIndex >= dueCards.length) return;
    
    setIsSubmitting(true);
    setCardTransition('flip-out');
    
    const currentCard = dueCards[currentCardIndex];
    const token = getAuthToken();

    try {
      const response = await fetch(`${API_BASE_URL}/api/srs/review/${encodeURIComponent(currentCard.kanji_character)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ grade }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }

      // Update session stats
      setSessionStats(prev => ({
        ...prev,
        completed: prev.completed + 1,
        correct: prev.correct + (grade >= 3 ? 1 : 0)
      }));

      // Smooth transition to next card
      setTimeout(() => {
        if (currentCardIndex + 1 >= dueCards.length) {
          setSessionComplete(true);
          setMessage('Session complete! Excellent work! 🎉');
        } else {
          setCurrentCardIndex(prev => prev + 1);
          setShowAnswer(false);
          setMessage('');
          setCardTransition('flip-in');
          setTimeout(() => setCardTransition(''), 300);
        }
      }, 300);
    } catch (err) {
      console.error('Error submitting review:', err);
      setMessage(`Error: ${err.message}`);
      setCardTransition('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startNewSession = () => {
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setMessage('');
    setSessionStats({ total: 0, completed: 0, correct: 0 });
    setSessionComplete(false);
    setCardTransition('');
    fetchDueCards();
  };

  const grades = [
    { value: 0, label: '忘れた', englishLabel: 'Forgot', color: 'from-red-500 to-red-600', description: 'Complete blackout', emoji: '😵' },
    { value: 1, label: '間違い', englishLabel: 'Wrong', color: 'from-orange-500 to-red-500', description: 'Incorrect response', emoji: '😓' },
    { value: 2, label: '難しい', englishLabel: 'Hard', color: 'from-yellow-500 to-orange-500', description: 'Correct with difficulty', emoji: '😰' },
    { value: 3, label: '普通', englishLabel: 'Good', color: 'from-blue-500 to-blue-600', description: 'Correct after hesitation', emoji: '🤔' },
    { value: 4, label: '簡単', englishLabel: 'Easy', color: 'from-emerald-500 to-green-600', description: 'Correct with ease', emoji: '😊' },
    { value: 5, label: '完璧', englishLabel: 'Perfect', color: 'from-purple-500 to-indigo-600', description: 'Perfect response', emoji: '🤩' },
  ];

  useEffect(() => {
    fetchDueCards();
  }, [fetchDueCards]);

  if (isLoading) {
    return (
      <div className="min-h-[600px] flex justify-center items-center">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="w-24 h-24 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-24 h-24 border-4 border-transparent border-t-purple-400 rounded-full animate-spin animation-delay-300 mx-auto"></div>
          </div>
          <h3 className="text-xl font-semibold text-slate-700 mb-2">Preparing your cards...</h3>
          <p className="text-slate-500">Finding the perfect kanji for your review session</p>
        </div>
      </div>
    );
  }

  if (sessionComplete || dueCards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8 text-center">
          <div className="mb-6">
            {dueCards.length === 0 ? (
              <>
                <div className="text-8xl mb-4">🌸</div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
                  素晴らしい！
                </h2>
                <p className="text-xl text-slate-600">No reviews due right now!</p>
              </>
            ) : (
              <>
                <div className="text-8xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent mb-2">
                  お疲れ様でした！
                </h2>
                <p className="text-xl text-slate-600">Session Complete!</p>
              </>
            )}
          </div>
          
          {sessionStats.total > 0 && (
            <div className="mb-8">
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Session Results</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">{sessionStats.total}</div>
                    <div className="text-sm text-slate-600">Cards Reviewed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-emerald-600 mb-1">{sessionStats.correct}</div>
                    <div className="text-sm text-slate-600">Correct</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-1">
                      {sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0}%
                    </div>
                    <div className="text-sm text-slate-600">Accuracy</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <button
            onClick={startNewSession}
            className="group relative px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-semibold text-lg transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/30"
          >
            <span className="relative z-10 flex items-center gap-2">
              🔄 Check for New Reviews
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
          
          {message && (
            <p className="mt-4 text-slate-600">{message}</p>
          )}
        </div>
      </div>
    );
  }

  const currentCard = dueCards[currentCardIndex];
  const progress = ((currentCardIndex + 1) / dueCards.length) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Progress Section */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Review Progress</h2>
          <span className="text-sm text-slate-600">{currentCardIndex + 1} of {dueCards.length}</span>
        </div>
        
        {/* Beautiful Progress Bar */}
        <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
          </div>
        </div>

        {/* Session Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
            <div className="text-2xl font-bold text-blue-600">{sessionStats.completed}</div>
            <div className="text-xs text-blue-600/70">Completed</div>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl">
            <div className="text-2xl font-bold text-emerald-600">{sessionStats.correct}</div>
            <div className="text-xs text-emerald-600/70">Correct</div>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
            <div className="text-2xl font-bold text-purple-600">
              {sessionStats.completed > 0 ? Math.round((sessionStats.correct / sessionStats.completed) * 100) : 0}%
            </div>
            <div className="text-xs text-purple-600/70">Accuracy</div>
          </div>
        </div>
      </div>

      {/* Card Display */}
      <div className="flex justify-center">
        <div className={`relative w-full max-w-md transition-all duration-300 ${cardTransition === 'flip-out' ? 'scale-95 opacity-50' : cardTransition === 'flip-in' ? 'scale-105' : 'scale-100'}`}>
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 p-8 text-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100/50 to-purple-100/50 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-pink-100/50 to-yellow-100/50 rounded-full translate-y-12 -translate-x-12"></div>
            
            <div className="relative z-10">
              {/* Kanji Display */}
              <div className="mb-8">
                <div className="relative inline-block">
                  <div className="text-8xl font-bold mb-4 p-8 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-2 border-slate-200 shadow-inner transition-all duration-300 hover:shadow-lg">
                    {currentCard.kanji_character}
                  </div>
                  {/* Floating details */}
                  <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                    Rep: {currentCard.repetition}
                  </div>
                </div>
              </div>

              {!showAnswer ? (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="group relative px-8 py-4 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-2xl font-semibold text-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    💭 Show Meaning
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
                    <p className="text-slate-700 font-medium mb-2">How well did you remember this kanji?</p>
                    <p className="text-sm text-slate-500">Choose your response honestly for optimal learning</p>
                  </div>
                  
                  {/* Grade Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    {grades.map((grade) => (
                      <button
                        key={grade.value}
                        onClick={() => submitReview(grade.value)}
                        disabled={isSubmitting}
                        className={`group relative p-4 bg-gradient-to-r ${grade.color} text-white rounded-2xl font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                        title={grade.description}
                      >
                        <div className="relative z-10">
                          <div className="text-2xl mb-1">{grade.emoji}</div>
                          <div className="font-semibold">{grade.label}</div>
                          <div className="text-xs opacity-90">{grade.englishLabel}</div>
                        </div>
                        <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {message && message.startsWith('Error:') && (
        <div className="bg-red-50/90 backdrop-blur-xl border border-red-200 text-red-700 p-4 rounded-2xl text-center">
          <div className="text-2xl mb-2">⚠️</div>
          {message}
        </div>
      )}
    </div>
  );
}

export default SrsReviewSession;