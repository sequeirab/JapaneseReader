// src/components/RegisterForm.jsx
import React, { useState } from 'react'; // Need useState for form inputs

function RegisterForm({ handleRegister, authError, isLoading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Optional: Add password confirmation field state if needed
  // const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault(); // Prevent default form submission behavior
    // Optional: Add password confirmation check here
    // if (password !== confirmPassword) { /* set error */ return; }
     if (!isLoading) { // Prevent double submit if already loading
        handleRegister(email, password);
     }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold text-center text-stone-700">Register</h2>
      {/* Display login/registration errors */}
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
      {/* Optional: Confirm Password Field */}
      {/* <div> ... </div> */}
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

export default RegisterForm;
