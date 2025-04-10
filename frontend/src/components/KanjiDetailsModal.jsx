// src/components/KanjiDetailsModal.jsx
// (This is the component responsible for rendering the modal window)
import React from 'react';
import { X } from 'lucide-react'; // Using lucide-react for the close icon

// Helper function to format readings arrays into comma-separated strings
const formatReadings = (readings) => (readings && readings.length > 0 ? readings.join(', ') : 'N/A');

function KanjiDetailsModal({ isOpen, onClose, kanjiChar, kanjiDetails }) {
  // If the modal is not set to be open (isOpen is false), render nothing
  if (!isOpen) return null;

  // Handler for clicking the backdrop (the semi-transparent background)
  const handleBackdropClick = (e) => {
    // Close modal only if the click is directly on the backdrop (e.target)
    // and not on the modal content itself (e.currentTarget)
    if (e.target === e.currentTarget) {
      onClose(); // Call the onClose function passed from App.jsx
    }
  };

  // Determine the content to display inside the modal based on kanjiDetails
  let content;
  if (!kanjiDetails) {
    // Display if details are missing or haven't loaded yet
    content = <p className="text-center text-stone-500">Loading details for {kanjiChar}...</p>;
  } else if (kanjiDetails.error) {
    // Display if there was an error fetching details from the backend/API
    content = <p className="text-center text-red-500">Error: {kanjiDetails.error}</p>;
  } else {
    // Display the full Kanji details if they are available and valid
    content = (
      <>
        {/* Kanji Character (Large, Centered) */}
        <h3 className="text-4xl font-bold text-center mb-4 text-orange-700">{kanjiChar}</h3>
        {/* Details Section */}
        <div className="space-y-3 text-sm text-stone-700">
          {/* Meanings */}
          {kanjiDetails.meanings && kanjiDetails.meanings.length > 0 && (
            <p><strong>Meanings:</strong> {kanjiDetails.meanings.join(', ')}</p>
          )}
          {/* On'yomi Readings */}
          {kanjiDetails.readings_on && (
            <p><strong>On'yomi:</strong> {formatReadings(kanjiDetails.readings_on)}</p>
          )}
          {/* Kun'yomi Readings */}
           {kanjiDetails.readings_kun && (
            <p><strong>Kun'yomi:</strong> {formatReadings(kanjiDetails.readings_kun)}</p>
          )}
          {/* Other details grid (strokes, grade, JLPT, etc.) */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-stone-200 mt-3">
             {/* Conditionally render each detail only if it exists */}
             {kanjiDetails.stroke_count && <p><strong>Strokes:</strong> {kanjiDetails.stroke_count}</p>}
             {kanjiDetails.grade && <p><strong>Grade:</strong> {kanjiDetails.grade}</p>}
             {kanjiDetails.jlpt && <p><strong>JLPT:</strong> {kanjiDetails.jlpt}</p>}
             {kanjiDetails.newspaper_frequency && <p><strong>Frequency:</strong> {kanjiDetails.newspaper_frequency}</p>}
             {kanjiDetails.radical && <p><strong>Radical:</strong> {kanjiDetails.radical}</p>}
             {kanjiDetails.taught_in && <p><strong>Taught In:</strong> {kanjiDetails.taught_in}</p>}
          </div>
        </div>
        {/* Link to Jisho.org */}
        {kanjiDetails.uri && (
          <a
            href={kanjiDetails.uri}
            target="_blank" // Open link in a new tab
            rel="noopener noreferrer" // Security best practice for target="_blank"
            className="block text-center text-sm text-blue-500 hover:text-blue-600 hover:underline mt-4"
          >
            View on Jisho.org →
          </a>
        )}
      </>
    );
  }

  return (
    // Backdrop container: Fixed position, covers the entire screen, applies background dimming/blur
    <div
      onClick={handleBackdropClick} // Attach backdrop click handler
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-200"
      aria-labelledby="kanji-modal-title" // Accessibility: Links to the modal title (though we don't have a visible one here)
      role="dialog" // Accessibility: Defines the element as a dialog window
      aria-modal="true" // Accessibility: Indicates it's a modal dialog, trapping focus
    >
      {/* Modal Content Area: White background, rounded corners, shadow, centered, max width */}
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative max-h-[80vh] overflow-y-auto">
        {/* Close Button: Positioned absolutely in the top-right corner */}
        <button
          onClick={onClose} // Attach the close handler passed from App.jsx
          className="absolute top-2 right-2 text-stone-500 hover:text-stone-700 transition-colors"
          aria-label="Close modal" // Accessibility: Provides a label for screen readers
        >
          <X size={20} /> {/* Close icon from lucide-react */}
        </button>

        {/* Dynamic Content Area (displays loading, error, or details) */}
        {content}
      </div>
    </div>
  );
}

export default KanjiDetailsModal;