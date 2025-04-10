// src/App.jsx
// (Includes Kanji Modal, SRS Tester integration)
// *** Standard Authentication Flow Restored - No Dev Bypass ***

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import TextInput from './components/TextInput';
import OutputDisplay from './components/OutputDisplay';
import AuthForms from './components/AuthForms';
import KanjiDetailsModal from './components/KanjiDetailsModal';
import SrsReviewTester from './components/SrsReviewTester';

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

  // --- Authentication State (Standard Flow) ---
  // Initialize authToken by reading from localStorage
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken'));
  // Initialize currentUser to null; useEffect will set it based on the token
  const [currentUser, setCurrentUser] = useState(null);
  // --- End Authentication State ---

  const [authError, setAuthError] = useState('');
  const [showLogin, setShowLogin] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // --- Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKanjiChar, setSelectedKanjiChar] = useState(null);
  const [selectedKanjiDetails, setSelectedKanjiDetails] = useState(null);
  // --- End Modal State ---

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

  // handleLogout (Restored standard version)
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setAuthToken(null); // Clearing token triggers useEffect to clear user
    // No need to set currentUser(null) directly here
    setProcessedData([]);
    setError(null);
    setAuthError('');
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
    <div className="min-h-screen text-stone-800 font-sans p-4 sm:p-8 flex flex-col items-center">
      <Header />

      {/* Conditional rendering based on standard login status */}
      {isLoggedIn ? (
        // --- Logged-in View ---
        <main className="w-full max-w-4xl bg-white/60 backdrop-blur-sm rounded-lg shadow-md p-6 mt-6 border border-stone-300/30">
          {/* User Info & Logout */}
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <p className="text-sm text-stone-600">Logged in as: {currentUser.email}</p>
            <button onClick={handleLogout} className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded shadow transition-colors">
              Logout
            </button>
          </div>
          {/* Text Input */}
          <TextInput
            inputText={inputText}
            setInputText={setInputText}
            handleProcessText={handleProcessText}
            isLoading={isLoading}
          />
          <hr className="my-6 border-t border-stone-300" />
          {/* Output Display */}
          <OutputDisplay
            processedData={processedData}
            isLoading={isLoading}
            error={error}
            handleKanjiClick={handleKanjiClick}
          />
          {/* SRS Tester */}
          <SrsReviewTester />
        </main>
      ) : (
        // --- Logged-out View ---
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
      )}

      {/* Modal */}
      <KanjiDetailsModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        kanjiChar={selectedKanjiChar}
        kanjiDetails={selectedKanjiDetails}
      />
       {/* Footer */}
       <footer className="mt-8 text-center text-stone-500 text-sm">
         Created with React
       </footer>
    </div>
  );
}

export default App;
