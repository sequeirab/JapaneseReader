// src/components/AuthForms.jsx
import React from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import { GoogleLogin } from '@react-oauth/google'; // Import GoogleLogin

// Placeholder function for handling Google token (will call backend later)
async function apiGoogleLogin(googleTokenCredential) {
    console.log("Received Google ID Token:", googleTokenCredential);
    // TODO: Send this token to a new backend endpoint (e.g., POST /auth/google)
    // const response = await fetch(API_BASE_URL + '/auth/google', { method: 'POST', ... body: { token: googleTokenCredential }});
    // Handle response, return { user, token } or throw error
    alert('Google Sign-In frontend successful! Backend logic not implemented yet.');
    // For now, return mock success to test UI flow
    // In real implementation, backend would return { user, token }
    // return { token: 'mock-app-jwt-from-google', user: { email: 'google.user@example.com', userId: 'google123' } };
    return null; // Indicate backend part not ready yet
}


function AuthForms({ showLogin, setShowLogin, handleLogin, handleRegister, authError, isLoading }) {

  // Handler for successful Google login on the frontend
  const handleGoogleSuccess = async (credentialResponse) => {
    // credentialResponse contains the Google ID token in credentialResponse.credential
    if (credentialResponse.credential) {
        try {
            // Call placeholder API function to handle the token
            const result = await apiGoogleLogin(credentialResponse.credential);

            if (result && result.token && result.user) {
                localStorage.setItem('authToken', result.token);
                // Need a way to update App's state (pass down setters or use Context)
                // setAuthToken(result.token); // Can't call App's setter directly
                console.log("Google login successful, need to update App state");
             }
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            // Need a way to show error (pass down setter or use Context)
            // setAuthError(error.message || 'Google Sign-In failed.');
            alert(`Google Sign-In Error: ${error.message || 'Unknown error'}`);
        }
    } else {
        console.error("Google Sign-In failed: No credential received.");
        alert('Google Sign-In failed: No credential received.');
    }
  };

  const handleGoogleError = () => {
    console.error('Google Sign-In failed');
    alert('Google Sign-In failed. Please try again.');
    // Optionally set an error state
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
         {/* Render the GoogleLogin component */}
         <GoogleLogin
             onSuccess={handleGoogleSuccess}
             onError={handleGoogleError}
             useOneTap // Optional: Enables One Tap sign-in prompt
             theme="outline"
             size="large"
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
