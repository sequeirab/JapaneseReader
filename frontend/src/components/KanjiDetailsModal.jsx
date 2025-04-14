import React, { useState } from 'react'; // Import useState
import { X, PlusCircle, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'; // Import new icons

// Get API Base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Helper to format readings
const formatReadings = (readings) => (readings && readings.length > 0 ? readings.join(', ') : 'N/A');

function KanjiDetailsModal({ isOpen, onClose, kanjiChar, kanjiDetails }) {
  // --- NEW: State for Add to SRS action ---
  const [isAddingSrs, setIsAddingSrs] = useState(false);
  const [addSrsMessage, setAddSrsMessage] = useState('');
  const [addSrsSuccess, setAddSrsSuccess] = useState(false); // Track success status
  // --- End NEW State ---

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // --- NEW: Handler for Add to SRS button click ---
  const handleSrsAddClick = async () => {
    if (!kanjiChar) return; // Should not happen if modal is open

    setIsAddingSrs(true);
    setAddSrsMessage(''); // Clear previous message
    setAddSrsSuccess(false); // Reset success status

    // Get token directly from localStorage for simplicity within the modal
    const token = localStorage.getItem('authToken');
    // --- Use a dummy token if in DEV mode and localStorage is empty ---
    const effectiveToken = import.meta.env.DEV && !token ? 'dev-dummy-token' : token;
    // --- End DEV mode token handling ---

    // Basic check if token exists (more robust check happens on backend)
    if (!effectiveToken && !import.meta.env.DEV) {
        setAddSrsMessage('Error: You must be logged in.');
        setIsAddingSrs(false);
        return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/srs/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Use effectiveToken which might be real or dummy in dev
          'Authorization': `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({ kanji: kanjiChar }), // Send the kanji character
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific auth errors
        if (response.status === 401 || response.status === 403) {
            throw new Error("Authentication failed. Please log in again.");
        }
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }

      // Success! Use message from backend
      setAddSrsMessage(data.message || 'Added successfully!');
      setAddSrsSuccess(true); // Mark as success

    } catch (err) {
      console.error('Add to SRS Error:', err);
      setAddSrsMessage(`Error: ${err.message}`);
      setAddSrsSuccess(false); // Mark as failure
    } finally {
      setIsAddingSrs(false); // Stop loading indicator
    }
  };
  // --- End NEW Handler ---

  // Determine main content based on details
  let content;
  if (!kanjiDetails) {
    content = <p className="text-center text-stone-500">Loading details for {kanjiChar}...</p>;
  } else if (kanjiDetails.error) {
    content = <p className="text-center text-red-500">Error: {kanjiDetails.error}</p>;
  } else {
    // Display the full Kanji details
    content = (
      <>
        <h3 className="text-4xl font-bold text-center mb-4 text-orange-700">{kanjiChar}</h3>
        <div className="space-y-3 text-sm text-stone-700">
          {/* Meanings, Readings, Other details grid... (Keep existing) */}
          {kanjiDetails.meanings && kanjiDetails.meanings.length > 0 && ( <p><strong>Meanings:</strong> {kanjiDetails.meanings.join(', ')}</p> )}
          {kanjiDetails.readings_on && ( <p><strong>On'yomi:</strong> {formatReadings(kanjiDetails.readings_on)}</p> )}
          {kanjiDetails.readings_kun && ( <p><strong>Kun'yomi:</strong> {formatReadings(kanjiDetails.readings_kun)}</p> )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-stone-200 mt-3">
             {kanjiDetails.stroke_count && <p><strong>Strokes:</strong> {kanjiDetails.stroke_count}</p>}
             {kanjiDetails.grade && <p><strong>Grade:</strong> {kanjiDetails.grade}</p>}
             {kanjiDetails.jlpt && <p><strong>JLPT:</strong> {kanjiDetails.jlpt}</p>}
             {kanjiDetails.newspaper_frequency && <p><strong>Frequency:</strong> {kanjiDetails.newspaper_frequency}</p>}
             {kanjiDetails.radical && <p><strong>Radical:</strong> {kanjiDetails.radical}</p>}
             {kanjiDetails.taught_in && <p><strong>Taught In:</strong> {kanjiDetails.taught_in}</p>}
          </div>
        </div>
        {/* Link to Jisho.org (Keep existing) */}
        {kanjiDetails.uri && (
          <a href={kanjiDetails.uri} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-blue-500 hover:text-blue-600 hover:underline mt-4">
            View on Jisho.org →
          </a>
        )}
      </>
    );
  }

  return (
    // Backdrop
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-200"
      aria-labelledby="kanji-modal-title" role="dialog" aria-modal="true"
    >
      {/* Modal Content */}
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative max-h-[80vh] overflow-y-auto">
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-2 right-2 text-stone-500 hover:text-stone-700 transition-colors" aria-label="Close modal">
          <X size={20} />
        </button>

        {/* Dynamic Content */}
        {content}

        {/* --- NEW: Add to SRS Section (only shown if details loaded successfully) --- */}
        {kanjiDetails && !kanjiDetails.error && (
          <div className="mt-5 pt-4 border-t border-stone-200">
            <button
              onClick={handleSrsAddClick}
              disabled={isAddingSrs} // Disable while adding
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 ${
                isAddingSrs
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                  : 'bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800'
              }`}
            >
              {isAddingSrs ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Adding...
                </>
              ) : (
                <>
                  <PlusCircle size={16} /> Add to Review Queue
                </>
              )}
            </button>
            {/* Display Success/Error Message */}
            {addSrsMessage && (
              <p className={`mt-2 text-xs text-center flex items-center justify-center gap-1 ${
                addSrsSuccess ? 'text-green-600' : 'text-red-600'
              }`}>
                {addSrsSuccess ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {addSrsMessage}
              </p>
            )}
          </div>
        )}
        {/* --- End NEW Section --- */}

      </div>
    </div>
  );
}

export default KanjiDetailsModal;