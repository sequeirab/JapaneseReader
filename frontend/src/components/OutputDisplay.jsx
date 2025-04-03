// src/components/OutputDisplay.jsx
import React, { useCallback } from 'react'; // Removed useState
import Tippy from '@tippyjs/react'; // Import Tippy
import 'tippy.js/dist/tippy.css'; // Import default Tippy CSS styles (optional but recommended)
// You might want to import other Tippy themes like 'light' or 'light-border'
// import 'tippy.js/themes/light.css';

// --- Removed the custom Tooltip component ---

// --- Main OutputDisplay Component ---
function OutputDisplay({ processedData, isLoading, error }) {

  // --- Removed tooltipData state and event handlers (handleKanjiMouseEnter, handleKanjiMouseLeave) ---

  // --- Function to Parse Furigana HTML and Wrap Kanji with Tippy ---
  const renderFurigana = useCallback((htmlString) => {
    if (!htmlString) return null;

    const kanjiRegex = /[\u4E00-\u9FAF\u3400-\u4DBF]/;
    const rubyRegex = /<ruby>([^<]+)(?:<rp>.*?<\/rp>)?<rt>(.*?)<\/rt>(?:<rp>.*?<\/rp>)?<\/ruby>/gs;

    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = rubyRegex.exec(htmlString)) !== null) {
      if (match.index > lastIndex) {
        parts.push(htmlString.substring(lastIndex, match.index));
      }

      const baseText = match[1];
      const rubyText = match[2];

      const baseElements = baseText.split('').map((char, index) => {
        if (kanjiRegex.test(char)) {
          // --- Wrap Kanji span with Tippy component ---
          return (
            <Tippy
              key={`${match.index}-base-${index}-tippy`}
              content={`Kanji: ${char}`} // Set tooltip content directly
              placement="bottom" // Specify desired placement (e.g., 'bottom', 'top', 'left', 'right')
              animation="fade"   // Optional animation
              duration={200}     // Optional duration
              // You can add more Tippy props for customization (delay, theme, etc.)
              // theme="light" // Example theme
            >
              <span
                className="kanji-hover" // Keep class for cursor/styling
                // Removed onMouseEnter/onMouseLeave - Tippy handles hover internally
              >
                {char}
              </span>
            </Tippy>
          );
          // --- End Tippy wrapper ---
        } else {
          return char;
        }
      });

      parts.push(
        <ruby key={match.index}>
          {baseElements}
          <rt>{rubyText}</rt>
        </ruby>
      );

      lastIndex = rubyRegex.lastIndex;
    }

    if (lastIndex < htmlString.length) {
      parts.push(htmlString.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [htmlString];

  }, []); // Removed dependencies on handlers


  // Determine current display state
  const hasResults = processedData && processedData.length > 0;
  const showInitialMessage = !isLoading && !error && !hasResults;

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4 text-stone-700">Results:</h2>

      {/* Loading Indicator */}
      {isLoading && (
         <div className="flex justify-center items-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            <p className="text-stone-500 ml-3">Loading results...</p>
         </div>
      )}

      {/* Error Message Display */}
      {error && <p className="text-red-600 bg-red-100 p-3 rounded-md border border-red-300">Error: {error}</p>}

      {/* Results Display Area */}
      {!isLoading && !error && hasResults && (
        <div className="space-y-4">
          {processedData.map((sentence, index) => (
            <div key={index} className="p-4 border border-stone-300/50 rounded-md bg-white/80 shadow-sm">
              <p className="text-2xl mb-2 text-stone-800 leading-relaxed">
                {renderFurigana(sentence.furigana_html || sentence.original)}
              </p>
              <p className="text-lg text-stone-700 italic mt-1">
                {sentence.translation || '[No Translation Provided]'}
              </p>
               {sentence.error && <p className="text-xs text-red-500 mt-1">Processing Error: {sentence.error}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Initial State Message */}
      {showInitialMessage && (
         <p className="text-stone-500">Enter text above and click "Process Text" to see results.</p>
      )}

      {/* --- Removed the custom Tooltip component rendering --- */}

      {/* --- CSS for hover effect & furigana positioning --- */}
      <style jsx global>{`
        .kanji-hover {
          cursor: pointer; /* Restore pointer cursor */
          transition: background-color 0.2s ease-in-out; /* Smooth transition */
          /* Optional: Add slight padding/margin if needed for highlight visibility */
          /* padding: 0 1px; */
          /* border-radius: 2px; */ /* Optional rounded corners for highlight */
        }
        .kanji-hover:hover {
           background-color: rgba(255, 235, 59, 0.5); /* Restore yellow highlight on hover */
        }
        rt {
            font-size: 0.7em;
            /* --- Add relative positioning to nudge furigana up slightly --- */
            position: relative;
            bottom: 3.5px; /* Adjust this value (e.g., 1px, 2px, 0.5px) if needed */
            /* --- End positioning adjustment --- */
        }
      `}</style>
      {/* --- End CSS --- */}
    </section>
  );
}

export default OutputDisplay;
