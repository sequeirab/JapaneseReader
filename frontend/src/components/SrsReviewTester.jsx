// src/components/SrsReviewTester.jsx
import React, { useState } from 'react';

// Get API Base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function SrsReviewTester() {
  // State for the Kanji input field
  const [kanjiToReview, setKanjiToReview] = useState('');
  // State to display messages from the backend
  const [message, setMessage] = useState('');
  // State to track loading during the API call
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Function to handle submitting a review
  const handleReviewSubmit = async (grade) => {
    // Basic validation
    if (!kanjiToReview || kanjiToReview.length !== 1) {
      setMessage('Please enter a single Kanji character.');
      return;
    }
    // Basic Kanji regex check (can be improved if needed)
    if (!/[\u4E00-\u9FAF\u3400-\u4DBF]/.test(kanjiToReview)) {
        setMessage('Please enter a valid Kanji character.');
        return;
    }

    setIsSubmitting(true); // Show loading state
    setMessage('Submitting review...'); // Indicate activity

    // Get the auth token from localStorage (needed for the protected route)
    const token = localStorage.getItem('authToken');
    // --- Use a dummy token if in DEV mode and localStorage is empty ---
    // This aligns with the dev bypass logic in App.jsx where localStorage might be empty
    const effectiveToken = import.meta.env.DEV && !token ? 'dev-dummy-token' : token;
    // --- End DEV mode token handling ---


    if (!effectiveToken && !import.meta.env.DEV) { // Only strictly check token if NOT in dev mode
        setMessage('Error: Not logged in. Cannot submit review.');
        setIsSubmitting(false);
        return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/srs/review/${encodeURIComponent(kanjiToReview)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include the Authorization header
          // Use the effectiveToken which might be real or dummy in dev
          'Authorization': `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({ grade: grade }), // Send the grade in the body
      });

      const data = await response.json(); // Attempt to parse response body

      if (!response.ok) {
        // If response is not OK, throw an error with the message from backend
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }

      // If successful, display the success message from backend
      setMessage(`Success: ${data.message || 'Review recorded.'} (Kanji: ${kanjiToReview}, Grade: ${grade})`);

    } catch (err) {
      // Display any errors that occurred during fetch or from the backend
      console.error('SRS Review Submit Error:', err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false); // Hide loading state
    }
  };

  // Grade buttons configuration
  const grades = [
    { value: 0, label: 'Forgot (0)' },
    { value: 1, label: 'Incorrect (1)' },
    { value: 2, label: 'Hard (2)' },
    { value: 3, label: 'Okay (3)' },
    { value: 4, label: 'Easy (4)' },
    { value: 5, label: 'Perfect (5)' },
  ];

  return (
    <div className="mt-6 p-4 border border-dashed border-stone-400 rounded-md bg-stone-50/50">
      <h3 className="text-lg font-semibold mb-3 text-stone-600">SRS Backend Tester</h3>
      <div className="flex items-center gap-4 mb-3">
        <label htmlFor="kanji-input" className="text-sm font-medium text-stone-700 whitespace-nowrap">
          Kanji to Review:
        </label>
        <input
          type="text"
          id="kanji-input"
          value={kanjiToReview}
          onChange={(e) => setKanjiToReview(e.target.value)}
          maxLength="1" // Allow only one character
          className="p-2 border border-stone-300 rounded-md w-16 text-center text-xl focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
          placeholder="日" // Example placeholder
          disabled={isSubmitting}
        />
      </div>

      <p className="text-sm text-stone-600 mb-2">Rate your recall:</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {grades.map((gradeInfo) => (
          <button
            key={gradeInfo.value}
            onClick={() => handleReviewSubmit(gradeInfo.value)}
            disabled={isSubmitting || !kanjiToReview}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded-md border transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              isSubmitting || !kanjiToReview
                ? 'bg-stone-200 text-stone-400 border-stone-300 cursor-not-allowed'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100 active:bg-stone-200 focus:ring-orange-500'
            }`}
          >
            {gradeInfo.label}
          </button>
        ))}
      </div>

      {/* Display messages */}
      {message && (
        <p className={`mt-3 text-sm p-2 rounded-md ${message.startsWith('Error:') ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
          {message}
        </p>
      )}
    </div>
  );
}

export default SrsReviewTester;
