// src/App.jsx (Refactored)
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import TextInput from './components/TextInput';
import OutputDisplay from './components/OutputDisplay';
import AuthForms from './components/AuthForms';


// Removed direct imports for LoginForm/RegisterForm as they are now used within AuthForms

// --- Configuration ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'; // Fallback

// --- Authentication API Call Functions ---
// (Keeping these here for now, could move to service file later)
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
  const [isLoading, setIsLoading] = useState(false); // For Gemini processing
  const [error, setError] = useState(null); // For Gemini processing errors

  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken'));
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [showLogin, setShowLogin] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // --- Effects ---
   useEffect(() => {
    if (authToken && !currentUser) {
        try {
            const payload = JSON.parse(atob(authToken.split('.')[1]));
            if (payload && payload.userId && payload.email) {
                 setCurrentUser({ userId: payload.userId, email: payload.email });
                 console.log("User state restored from token:", payload.email);
            } else { throw new Error("Invalid token payload structure."); }
        } catch (e) {
            console.error("Error decoding token or invalid payload, clearing stored token:", e);
            localStorage.removeItem('authToken');
            setAuthToken(null);
            setCurrentUser(null);
        }
    }
    else if (!authToken && currentUser) {
        setCurrentUser(null);
    }
  }, [authToken, currentUser]);


  // --- API Call Handlers ---
  const handleProcessText = async () => {
    // ... (Keep existing handleProcessText logic) ...
     if (!inputText.trim()) { setError('Please enter some Japanese text.'); return; }
     setIsLoading(true);
     setError(null);
     setProcessedData([]);
     try {
       const response = await fetch(API_BASE_URL + '/api/process-text', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', },
         body: JSON.stringify({ text: inputText }),
       });
       if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `HTTP error! Status: ${response.status}` }));
          throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
       }
       const data = await response.json();
       if (data && data.processedSentences) {
          setProcessedData(data.processedSentences);
       } else {
           console.error("Unexpected response structure:", data);
           throw new Error("Received unexpected data structure from backend.");
       }
     } catch (err) {
         console.error('API call failed:', err);
         setError(err.message || 'Failed to connect to the backend or process the text.');
     } finally {
       setIsLoading(false);
     }
  };

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

  const handleLogin = async (email, password) => {
    setAuthError('');
    setIsAuthLoading(true);
    try {
      const result = await apiLogin(email, password);
      if (result && result.token && result.user) {
          localStorage.setItem('authToken', result.token);
          setAuthToken(result.token);
          // No need to set currentUser here, useEffect handles it
      } else {
          setAuthError('Login failed. Unexpected response.');
      }
    } catch (err) {
      setAuthError(err.message || 'Login failed.');
    } finally {
       setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setAuthToken(null); // This will trigger useEffect to clear currentUser
    setProcessedData([]);
    setError(null);
    setAuthError('');
    console.log("User logged out");
  };

  // --- Render Logic ---
  return (
    <div className="min-h-screen text-stone-800 font-sans p-4 sm:p-8 flex flex-col items-center">
      <Header />

      {/* Conditionally render Auth forms or Main App */}
      {authToken && currentUser ? (
        // --- Logged-in View ---
        <main className="w-full max-w-4xl bg-white/60 backdrop-blur-sm rounded-lg shadow-md p-6 mt-6 border border-stone-300/30">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <p className="text-sm text-stone-600">Logged in as: {currentUser.email}</p>
            <button
              onClick={handleLogout}
              className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded shadow transition-colors"
            >
              Logout
            </button>
          </div>
          {/* Use imported components */}
          <TextInput
            inputText={inputText}
            setInputText={setInputText}
            handleProcessText={handleProcessText}
            isLoading={isLoading}
          />
          <hr className="my-6 border-t border-stone-300" />
          <OutputDisplay
            processedData={processedData}
            isLoading={isLoading}
            error={error}
          />
        </main>
      ) : (
        // --- Logged-out View ---
        // Use imported component
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

       <footer className="mt-8 text-center text-stone-500 text-sm">
         Created with React
       </footer>
    </div>
  );
}

export default App;
