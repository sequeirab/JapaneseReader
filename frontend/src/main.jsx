// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // Your Tailwind CSS import
import { GoogleOAuthProvider } from '@react-oauth/google'; // Import the provider

// Get Google Client ID from environment variables
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (!googleClientId) {
  console.error("ERROR: Missing VITE_GOOGLE_CLIENT_ID environment variable.");
  // Optionally render an error message or prevent app load
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Wrap App with the provider, passing the Client ID */}
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>,
)
