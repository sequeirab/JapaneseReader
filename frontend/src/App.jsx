
import React, { useState, useEffect } from 'react';

// --- Configuration ---

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'; // Fallback for safety

// --- Authentication API Call Functions ---
async function apiRegister(email, password) {
  console.log("Attempting registration for:", email);
  const response = await fetch(API_BASE_URL + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json(); 

  if (!response.ok) {
    // Throw error with message from backend if available, otherwise generic message
    throw new Error(data.error || `HTTP error! Status: ${response.status}`);
  }
  console.log("Registration API success:", data);
  return data.user; 
}

async function apiLogin(email, password) {
  console.log("Attempting login for:", email);
  const response = await fetch(API_BASE_URL + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    // Throw error with message from backend if available, otherwise generic message
    throw new Error(data.error || `HTTP error! Status: ${response.status}`);
  }

  // Check if token and user exist in the successful response
  if (data && data.token && data.user) {
    console.log("Login API success:", data.user.email);
    return { token: data.token, user: data.user }; // Return token and user object
  } else {
    // Should not happen if backend sends correct response on success
    console.error("Login API response missing token or user:", data);
    throw new Error("Login successful, but received unexpected data from server.");
  }
}

// --- Main App Component ---
function App() {
  // State variables
  const [inputText, setInputText] = useState('');
  const [processedData, setProcessedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // For Gemini processing
  const [error, setError] = useState(null); // For Gemini processing errors

  // Auth State
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken'));
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [showLogin, setShowLogin] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false); // Loading state for auth operations

  // --- Effects ---
  // Restore user state from token on initial load
   useEffect(() => {
    if (authToken && !currentUser) {
        try {
            // Decode payload - WARNING: Does not verify signature!
            const payload = JSON.parse(atob(authToken.split('.')[1]));
            // Basic check if payload looks like expected user data
            if (payload && payload.userId && payload.email) {
                 setCurrentUser({ userId: payload.userId, email: payload.email });
                 console.log("User state restored from token:", payload.email);
            } else {
                 throw new Error("Invalid token payload structure.");
            }
        } catch (e) {
            console.error("Error decoding token or invalid payload, clearing stored token:", e);
            localStorage.removeItem('authToken');
            setAuthToken(null);
            setCurrentUser(null);
        }
    }
  }, [authToken, currentUser]); // Depend on authToken


  // --- API Call Handlers ---
  const handleProcessText = async () => {
    if (!inputText.trim()) { setError('Please enter some Japanese text.'); return; }
    setIsLoading(true);
    setError(null);
    setProcessedData([]);
    try {
      const response = await fetch(API_BASE_URL + '/api/process-text', { // Use constant
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          
        },
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

  // Authentication Handlers
  const handleRegister = async (email, password) => {
    setAuthError('');
    setIsAuthLoading(true); // Start loading
    try {
      const registeredUser = await apiRegister(email, password);
      // Show success message, prompt to login
      alert(`Registration successful for ${registeredUser?.email}! Please log in.`);
      setShowLogin(true); // Switch to login view
    } catch (err) {
      setAuthError(err.message || 'Registration failed.');
    } finally {
       setIsAuthLoading(false); // Stop loading
    }
  };

  const handleLogin = async (email, password) => {
    setAuthError('');
    setIsAuthLoading(true); // Start loading
    try {
      const result = await apiLogin(email, password);
      // Check if result is valid before setting state
      if (result && result.token && result.user) {
          localStorage.setItem('authToken', result.token);
          setAuthToken(result.token);
          setCurrentUser(result.user);
      } else {
          // This case should ideally be caught by errors thrown in apiLogin
          setAuthError('Login failed. Unexpected response.');
      }
    } catch (err) {
      setAuthError(err.message || 'Login failed.');
    } finally {
       setIsAuthLoading(false); // Stop loading
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setCurrentUser(null);
    setProcessedData([]);
    setError(null);
    setAuthError('');
    console.log("User logged out");
  };

  // --- Render Logic ---
  return (
    <div className="min-h-screen bg-orange-50 text-stone-800 font-sans p-4 sm:p-8 flex flex-col items-center">
      <Header />

      {/* Conditionally render Auth forms or Main App */}
      {authToken && currentUser ? (
        // --- Logged-in View ---
        <main className="w-full max-w-4xl bg-white/60 backdrop-blur-sm rounded-lg shadow-md p-6 mt-6 border border-stone-300/30">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2"> {/* Added flex-wrap */}
            <p className="text-sm text-stone-600">Logged in as: {currentUser.email}</p>
            <button
              onClick={handleLogout}
              className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded shadow transition-colors"
            >
              Logout
            </button>
          </div>
          <TextInput
            inputText={inputText}
            setInputText={setInputText}
            handleProcessText={handleProcessText}
            isLoading={isLoading} // Pass Gemini loading state
          />
          <hr className="my-6 border-t border-stone-300" />
          <OutputDisplay
            processedData={processedData}
            isLoading={isLoading} // Pass Gemini loading state
            error={error}
          />
        </main>
      ) : (
        // --- Logged-out View ---
        <AuthForms
          showLogin={showLogin}
          setShowLogin={setShowLogin}
          handleLogin={handleLogin}
          handleRegister={handleRegister}
          authError={authError}
          isLoading={isAuthLoading} // Pass auth loading state
        />
      )}

       <footer className="mt-8 text-center text-stone-500 text-sm">
         Created with React & Gemini
       </footer>
    </div>
  );
}

// --- Authentication Form Components ---

function AuthForms({ showLogin, setShowLogin, handleLogin, handleRegister, authError, isLoading }) {
  return (
    <div className="w-full max-w-md bg-white/60 backdrop-blur-sm rounded-lg shadow-md p-6 mt-6 border border-stone-300/30">
      {showLogin ? (
        <LoginForm handleLogin={handleLogin} authError={authError} isLoading={isLoading} />
      ) : (
        <RegisterForm handleRegister={handleRegister} authError={authError} isLoading={isLoading} />
      )}
      <div className="mt-4 text-center">
        <button
          onClick={() => setShowLogin(!showLogin)}
          disabled={isLoading} // Disable toggle while loading
          className="text-sm text-orange-600 hover:underline disabled:opacity-50"
        >
          {showLogin ? 'Need an account? Register' : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
}

function LoginForm({ handleLogin, authError, isLoading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isLoading) { 
        handleLogin(email, password);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold text-center text-stone-700">Login</h2>
      {authError && <p className="text-red-600 text-sm text-center bg-red-100 p-2 rounded">{authError}</p>}
      <div>
        <label className="block text-sm font-medium text-stone-600">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
          className="mt-1 block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm disabled:opacity-50"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-600">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
          className="mt-1 block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm disabled:opacity-50"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
      >
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}

function RegisterForm({ handleRegister, authError, isLoading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
     if (!isLoading) { // Prevent double submit
        handleRegister(email, password);
     }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold text-center text-stone-700">Register</h2>
      {authError && <p className="text-red-600 text-sm text-center bg-red-100 p-2 rounded">{authError}</p>}
      <div>
        <label className="block text-sm font-medium text-stone-600">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
          className="mt-1 block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm disabled:opacity-50"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-600">Password (min. 6 characters)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          disabled={isLoading}
          className="mt-1 block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm disabled:opacity-50"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
      >
        {isLoading ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
}


// --- Existing Components (Header, TextInput, OutputDisplay) ---
// Keep the existing Header, TextInput, and OutputDisplay components here
// Ensure they use the correct props passed down from App

function Header() {
  return ( <header className="text-center mb-6"><h1 className="text-3xl sm:text-4xl font-bold text-stone-700">Japanese Reader</h1></header> );
}

function TextInput({ inputText, setInputText, handleProcessText, isLoading }) {
  return ( <section><label htmlFor="japanese-text" className="block text-lg font-semibold mb-2 text-stone-700">Enter Japanese text:</label><textarea id="japanese-text" rows="4" value={inputText} onChange={(e) => setInputText(e.target.value)} className="w-full p-3 border border-stone-300 rounded-md focus:ring-2 focus:ring-orange-600 focus:border-transparent resize-none bg-white/80 placeholder-gray-500" placeholder="ここに日本語のテキストを入力してください..." disabled={isLoading} /><button onClick={handleProcessText} disabled={isLoading || !inputText.trim()} className={`mt-4 px-6 py-2 rounded-md text-white font-semibold transition-all duration-200 ease-in-out shadow focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 focus:ring-offset-orange-50 ${ isLoading || !inputText.trim() ? 'bg-orange-600/50 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700 active:scale-95' }`}>{isLoading ? 'Processing...' : 'Process Text'}</button></section> );
}

function OutputDisplay({ processedData, isLoading, error }) {
  const createMarkup = (htmlString) => ({ __html: htmlString || '' });
  const hasResults = processedData && processedData.length > 0;
  const showInitialMessage = !isLoading && !error && !hasResults;
  return ( <section><h2 className="text-xl font-semibold mb-4 text-stone-700">Results:</h2>{isLoading && ( <div className="flex justify-center items-center p-4"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div><p className="text-stone-500 ml-3">Loading results...</p></div> )}{error && <p className="text-red-600 bg-red-100 p-3 rounded-md border border-red-300">Error: {error}</p>}{!isLoading && !error && hasResults && ( <div className="space-y-4">{processedData.map((sentence, index) => ( <div key={index} className="p-4 border border-stone-300/50 rounded-md bg-white/80 shadow-sm"><p className="text-2xl mb-2 text-stone-800 leading-relaxed" dangerouslySetInnerHTML={createMarkup(sentence.furigana_html || sentence.original)} /><p className="text-lg text-stone-700 italic mt-1">{sentence.translation || '[No Translation Provided]'}</p>{sentence.error && <p className="text-xs text-red-500 mt-1">Processing Error: {sentence.error}</p>}</div> ))}</div> )}{showInitialMessage && ( <p className="text-stone-500">Enter text above and click "Process Text" to see results.</p> )}</section> );
}

export default App;

