import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Navbar from './components/Navbar'; // Import Navbar
import TextInput from './components/TextInput';
import OutputDisplay from './components/OutputDisplay';
import AuthForms from './components/AuthForms';
import KanjiDetailsModal from './components/KanjiDetailsModal';
import SrsReviewSession from './components/SrsReviewSession';
import SrsDashboard from './components/SrsDashboard';
import SrsQueueManager from './components/SrsQueueManager';

// --- Configuration ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// --- API Call Functions (Keep existing) ---
async function apiRegister(email, password) {
    console.log("Attempting registration via API for:", email);
    const response = await fetch(API_BASE_URL + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
        console.error("Registration API failed:", data);
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
    }
    console.log("Registration API success:", data);
    return data.user;
}
async function apiLogin(email, password) {
    console.log("Attempting login via API for:", email);
    const response = await fetch(API_BASE_URL + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
        console.error("Login API failed:", data);
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
    }
    if (data && data.token && data.user) {
        console.log("Login API success:", data.user.email);
        return { token: data.token, user: data.user };
    } else {
        console.error("Login API response missing token or user:", data);
        throw new Error("Login successful, but received unexpected data from server.");
    }
}

// --- Main App Component ---
function App() {
  // --- State ---
  const [inputText, setInputText] = useState('');
  const [processedData, setProcessedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken'));
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [showLogin, setShowLogin] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKanjiChar, setSelectedKanjiChar] = useState(null);
  const [selectedKanjiDetails, setSelectedKanjiDetails] = useState(null);
  const [activeView, setActiveView] = useState('reader');
  const [srsView, setSrsView] = useState('dashboard');

  // --- Effects ---
  // Standard useEffect to sync currentUser with authToken
  useEffect(() => {
    // If a token exists in state but no user is set...
    if (authToken && !currentUser) {
        try {
            // Decode token payload
            const payload = JSON.parse(atob(authToken.split('.')[1]));
            // Validate payload structure and expiration
            if (payload && payload.userId && payload.email && typeof payload.exp === 'number') {
                 if (Date.now() >= payload.exp * 1000) { // Check expiration
                    console.log("Token expired, logging out.");
                    throw new Error("Token expired.");
                 }
                 // Set user state if token is valid
                 setCurrentUser({ userId: payload.userId, email: payload.email });
                 console.log("User state restored from token:", payload.email);
            } else { throw new Error("Invalid token payload structure."); }
        } catch (e) { // Handle errors (decode, validation, expiration)
            console.error("Error with token. Clearing stored token:", e.message);
            localStorage.removeItem('authToken'); // Clean up bad/expired token
            setAuthToken(null);
            setCurrentUser(null);
        }
    }
    // If token was removed (logout) but user state still exists, clear user state
    else if (!authToken && currentUser) {
        setCurrentUser(null);
    }
  }, [authToken, currentUser]); // Re-run when token or user state changes

  // --- API Call Handlers ---
  // handleProcessText (Corrected version that sends header if token exists)
  const handleProcessText = async () => {
     if (!inputText.trim()) {
       setError('Please enter some Japanese text.');
       setProcessedData([]);
       return;
     }
     setIsLoading(true);
     setError(null);
     setProcessedData([]);
     try {
       const headers = { 'Content-Type': 'application/json' };
       const currentToken = authToken; // Use the token from state

       if (currentToken) {
         headers['Authorization'] = `Bearer ${currentToken}`; // Add header if token exists
         console.log("handleProcessText: Sending Authorization header.");
       } else {
         // This case should ideally only happen if the user tries to call this
         // while not logged in, which the UI should prevent.
         // The backend middleware will handle the rejection.
         console.warn("handleProcessText: No auth token found. Request will likely fail if route is protected.");
       }

       const response = await fetch(API_BASE_URL + '/api/process-text', {
         method: 'POST',
         headers: headers,
         body: JSON.stringify({ text: inputText }),
       });

       // Check for auth errors specifically
       if (response.status === 401 || response.status === 403) {
           console.error("Authentication error processing text:", response.status);
           throw new Error("Authentication failed. Please log in again.");
       }
       // Check for other non-OK errors
       if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `HTTP error! Status: ${response.status}` }));
          throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
       }
       // Process successful response
       const data = await response.json();
       if (data && data.processedSentences) {
          setProcessedData(data.processedSentences);
       } else {
           console.error("Unexpected response structure:", data);
           throw new Error("Received unexpected data structure from backend.");
       }
     } catch (err) {
         console.error('API call failed:', err);
         // If the error is auth-related, log the user out
         if (err.message.includes("Authentication failed")) {
             handleLogout(); // Force logout if token seems invalid
         }
         setError(err.message || 'Failed to connect to the backend or process the text.');
     } finally {
       setIsLoading(false);
     }
  };

  // handleRegister (No changes needed)
  const handleRegister = async (email, password) => {
    setAuthError('');
    setIsAuthLoading(true);
    try {
      const registeredUser = await apiRegister(email, password);
      alert(`Registration successful for ${registeredUser?.email}! Please log in.`);
      setShowLogin(true);
    } catch (err) {
      setAuthError(err.message || 'Registration failed.');
    } finally {
       setIsAuthLoading(false);
    }
  };

  // handleLogin (No changes needed)
  const handleLogin = async (email, password) => {
    setAuthError('');
    setIsAuthLoading(true);
    try {
      const result = await apiLogin(email, password);
      if (result && result.token && result.user) {
          localStorage.setItem('authToken', result.token);
          setAuthToken(result.token); // Update token state -> useEffect sets user
      } else {
          setAuthError('Login failed. Unexpected response from server.');
      }
    } catch (err) {
      setAuthError(err.message || 'Login failed.');
    } finally {
       setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setProcessedData([]);
    setError(null);
    setAuthError('');
    setActiveView('reader');
    console.log("User logged out");
  };


  // --- Modal Handlers (No changes needed) ---
  const handleKanjiClick = (kanjiChar, details) => {
    console.log("Kanji clicked:", kanjiChar, "Details:", details);
    setSelectedKanjiChar(kanjiChar);
    setSelectedKanjiDetails(details);
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedKanjiChar(null);
    setSelectedKanjiDetails(null);
  };
  // --- End Modal Handlers ---

  // --- Determine if logged in (Standard logic) ---
  // User is logged in if both token and user info are present
  const isLoggedIn = !!authToken && !!currentUser;

  // --- Render Logic ---
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Japanese Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-red-200/30 to-pink-200/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/4 -left-20 w-60 h-60 bg-gradient-to-br from-blue-200/20 to-indigo-200/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-gradient-to-br from-purple-200/25 to-pink-200/25 rounded-full blur-2xl animate-pulse delay-2000"></div>
        
        {/* Subtle Japanese Pattern Overlay */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col items-center">
          <Header />

          {isLoggedIn ? (
            // --- Logged-in View ---
            <div className="w-full max-w-7xl">
              <Navbar
                activeView={activeView}
                setActiveView={setActiveView}
                handleLogout={handleLogout}
              />
              
              <main className="mt-8">
                {/* Conditionally render content based on activeView */}
                {activeView === 'reader' && (
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-8 transition-all duration-500 hover:shadow-2xl">
                    {/* Text Input */}
                    <TextInput
                      inputText={inputText}
                      setInputText={setInputText}
                      handleProcessText={handleProcessText}
                      isLoading={isLoading}
                    />
                    
                    {/* Elegant Divider */}
                    <div className="my-8 flex items-center">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
                      <div className="px-4">
                        <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                      </div>
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
                    </div>
                    
                    {/* Output Display */}
                    <OutputDisplay
                      processedData={processedData}
                      isLoading={isLoading}
                      error={error}
                      handleKanjiClick={handleKanjiClick}
                    />
                  </div>
                )}

                {activeView === 'srs' && (
                  <div className="space-y-6">
                    {/* Modern SRS Navigation */}
                    <div className="flex justify-center">
                      <div className="inline-flex bg-white/80 backdrop-blur-xl rounded-2xl p-2 shadow-lg border border-white/30">
                        <button
                          onClick={() => setSrsView('dashboard')}
                          className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden group ${
                            srsView === 'dashboard'
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 transform scale-105'
                              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            📊 Dashboard
                          </span>
                          {srsView === 'dashboard' && (
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          )}
                        </button>
                        
                        <button
                          onClick={() => setSrsView('review')}
                          className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden group ${
                            srsView === 'review'
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 transform scale-105'
                              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            🎯 Review
                          </span>
                          {srsView === 'review' && (
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          )}
                        </button>
                        
                        <button
                          onClick={() => setSrsView('queue')}
                          className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden group ${
                            srsView === 'queue'
                              ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/25 transform scale-105'
                              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            📚 Manage
                          </span>
                          {srsView === 'queue' && (
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-violet-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* SRS Content with Smooth Transitions */}
                    <div className="transition-all duration-500 ease-in-out">
                      {srsView === 'dashboard' && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                          <SrsDashboard onNavigateToReview={() => setSrsView('review')} />
                        </div>
                      )}
                      {srsView === 'review' && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                          <SrsReviewSession />
                        </div>
                      )}
                      {srsView === 'queue' && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                          <SrsQueueManager />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </main>
            </div>
          ) : (
            // --- Logged-out View ---
            <div className="w-full max-w-md animate-in fade-in duration-700">
              <AuthForms
                showLogin={showLogin}
                setShowLogin={setShowLogin}
                handleLogin={handleLogin}
                handleRegister={handleRegister}
                authError={authError}
                isLoading={isAuthLoading}
                setAuthToken={setAuthToken}
                setCurrentUser={setCurrentUser}
                setAuthError={setAuthError}
                setIsAuthLoading={setIsAuthLoading}
              />
            </div>
          )}

          {/* Modal */}
          <KanjiDetailsModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            kanjiChar={selectedKanjiChar}
            kanjiDetails={selectedKanjiDetails}
          />
          
          {/* Modern Footer */}
          <footer className="mt-16 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-white/30 text-slate-500 text-sm">
              <span>Made with</span>
              <span className="text-red-400 animate-pulse">❤️</span>
              <span>for Japanese learners</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default App;
