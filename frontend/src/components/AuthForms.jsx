// src/components/AuthForms.jsx
import React from 'react'; // No useState needed here directly
import LoginForm from './LoginForm'; // Import child components
import RegisterForm from './RegisterForm'; // Import child components

function AuthForms({ showLogin, setShowLogin, handleLogin, handleRegister, authError, isLoading }) {
  return (
    <div className="w-full max-w-md bg-white/60 backdrop-blur-sm rounded-lg shadow-md p-6 mt-6 border border-stone-300/30">
      {/* Conditionally render Login or Register Form */}
      {showLogin ? (
        <LoginForm handleLogin={handleLogin} authError={authError} isLoading={isLoading} />
      ) : (
        <RegisterForm handleRegister={handleRegister} authError={authError} isLoading={isLoading} />
      )}
      {/* Toggle Button */}
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

export default AuthForms;
