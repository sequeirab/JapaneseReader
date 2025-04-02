// src/components/AuthForms.jsx
import React from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import { GoogleLogin } from '@react-oauth/google';

// --- Configuration --- (Get API Base URL - could also pass down from App)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// --- Google Auth API Call Function ---
// Moved implementation here for simplicity, could be in a service file
async function apiGoogleLogin(googleTokenCredential) {
  console.log("Sending Google ID Token to backend:", googleTokenCredential);
  const response = await fetch(API_BASE_URL + '/auth/google', { // Calls the backend endpoint
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ googleToken: googleTokenCredential }), // Send token in correct format
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Google Backend Auth failed:", data);
    throw new Error(data.error || `HTTP error! Status: ${response.status}`);
  }

  // Expecting { token: 'app-jwt', user: { userId, email } } from backend
  if (data && data.token && data.user) {
    console.log("Google Backend Auth success:", data.user.email);
    return { token: data.token, user: data.user };
  } else {
    console.error("Google Backend Auth response missing token or user:", data);
    throw new Error("Authentication successful, but received unexpected data from server.");
  }
}


// --- AuthForms Component ---
// Now receives state setters as props from App
function AuthForms({
    showLogin, setShowLogin,
    handleLogin, handleRegister, authError, isLoading,
    setAuthToken, setCurrentUser, setAuthError, setIsAuthLoading // New props from App
 }) {

  // Handler for successful Google login on the frontend
  const handleGoogleSuccess = async (credentialResponse) => {
    if (credentialResponse.credential) {
      setAuthError(''); // Clear previous errors
      setIsAuthLoading(true); // Set loading state via prop function
      try {
        // Call the *real* API function to verify token with backend
        const result = await apiGoogleLogin(credentialResponse.credential);

        // If backend verification succeeds and returns app token/user
        if (result && result.token && result.user) {
            localStorage.setItem('authToken', result.token); // Store app token
            // Update App's state using functions passed as props
            setAuthToken(result.token);
            setCurrentUser(result.user);
        } else {
             // Should be caught by errors thrown in apiGoogleLogin
             setAuthError('Google Sign-In successful, but failed to log into application.');
        }
      } catch (error) {
          console.error("Google Sign-In Error:", error);
          // Set App's error state using function passed as prop
          setAuthError(error.message || 'Google Sign-In failed.');
      } finally {
          setIsAuthLoading(false); // Clear loading state via prop function
      }
    } else {
        console.error("Google Sign-In failed: No credential received.");
        setAuthError('Google Sign-In failed: No credential received.');
    }
  };

  // onError handler remains the same
  const handleGoogleError = () => {
    console.error('Google Sign-In failed');
    setAuthError('Google Sign-In failed. Please try again.'); // Use prop function
  };


  return (
    <div className="w-full max-w-md bg-white/60 backdrop-blur-sm rounded-lg shadow-md p-6 mt-6 border border-stone-300/30">
      {/* Login or Register Form */}
      {showLogin ? (
        <LoginForm handleLogin={handleLogin} authError={authError} isLoading={isLoading} />
      ) : (
        <RegisterForm handleRegister={handleRegister} authError={authError} isLoading={isLoading} />
      )}

      {/* Divider */}
      <div className="my-4 flex items-center before:mt-0.5 before:flex-1 before:border-t before:border-stone-300 after:mt-0.5 after:flex-1 after:border-t after:border-stone-300">
        <p className="mx-4 mb-0 text-center font-semibold text-stone-500">OR</p>
      </div>

      {/* Google Login Button */}
      <div className="flex justify-center">
         <GoogleLogin
             onSuccess={handleGoogleSuccess}
             onError={handleGoogleError}
             // useOneTap // Optional
             theme="outline"
             size="large"
             disabled={isLoading} // Disable while auth is loading
         />
      </div>

      {/* Toggle Button */}
      <div className="mt-4 text-center">
        <button
          onClick={() => setShowLogin(!showLogin)}
          disabled={isLoading}
          className="text-sm text-orange-600 hover:underline disabled:opacity-50"
        >
          {showLogin ? 'Need an account? Register' : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
}

export default AuthForms;
