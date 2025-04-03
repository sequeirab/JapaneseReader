// src/components/OutputDisplay.jsx
import React, { useCallback } from 'react';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css'; // Import default Tippy CSS styles
// import 'tippy.js/themes/light.css'; // Optional theme

// --- NEW: Component to render formatted Kanji details in the tooltip ---
function KanjiTooltipContent({ details, kanjiChar }) {
  // Handle cases where details might be missing or lookup failed
  if (!details) {
    return `No details found for ${kanjiChar}.`;
  }
  if (details.error) {
    return `Error looking up ${kanjiChar}: ${details.error}`;
  }

  // Helper to join readings array, handling potential undefined/empty arrays
  const formatReadings = (readings) => (readings && readings.length > 0 ? readings.join(', ') : 'N/A');

  return (
    <div className="text-left p-1 max-w-xs"> {/* Basic tooltip styling */}
      <h4 className="font-bold text-lg mb-1">{kanjiChar}</h4>
      {details.meanings && details.meanings.length > 0 && (
        <p className="text-sm mb-1"><strong>Meanings:</strong> {details.meanings.join(', ')}</p>
      )}
      <p className="text-sm mb-1">
        <strong>On:</strong> {formatReadings(details.readings_on)}
        <strong className="ml-3">Kun:</strong> {formatReadings(details.readings_kun)}
      </p>
      <div className="text-xs text-gray-300 mt-1"> {/* Lighter text for secondary info */}
        {details.stroke_count && <span>Strokes: {details.stroke_count}</span>}
        {details.grade && <span className="ml-2">Grade: {details.grade}</span>}
        {details.jlpt && <span className="ml-2">JLPT: N{details.jlpt}</span>}
      </div>
       {/* Optional: Link to Jisho page */}
       {details.uri && (
            <a
                href={details.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 mt-1 block"
            >
                View on Jisho.org
            </a>
        )}
    </div>
  );
}


// --- Main OutputDisplay Component ---
function OutputDisplay({ processedData, isLoading, error }) {

  // --- Function to Parse Furigana HTML and Wrap Kanji with Tippy ---
  // Now accepts kanjiDetailsMap for the current sentence
  const renderFurigana = useCallback((htmlString, kanjiDetailsMap) => {
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
          // --- Look up details for this specific Kanji character ---
          const details = kanjiDetailsMap ? kanjiDetailsMap[char] : null;

          return (
            <Tippy
              key={`${match.index}-base-${index}-tippy`}
              // --- Use the new component for tooltip content ---
              content={<KanjiTooltipContent details={details} kanjiChar={char} />}
              allowHTML={true} // IMPORTANT: Allow HTML/JSX in content
              // --- End content update ---
              placement="bottom"
              animation="fade"
              duration={200}
              interactive={true} // Allow interacting with tooltip content (e.g., clicking link)
              // theme="light"
            >
              <span className="kanji-hover">
                {char}
              </span>
            </Tippy>
          );
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

  }, []); // No dependencies needed


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
          {/* --- Pass kanji_details_map to renderFurigana --- */}
          {processedData.map((sentence, index) => (
            <div key={index} className="p-4 border border-stone-300/50 rounded-md bg-white/80 shadow-sm">
              <p className="text-2xl mb-2 text-stone-800 leading-relaxed">
                {/* Pass the map for the current sentence */}
                {renderFurigana(sentence.furigana_html || sentence.original_sentence, sentence.kanji_details_map)}
              </p>
              <p className="text-lg text-stone-700 italic mt-1">
                {sentence.translation || '[No Translation Provided]'}
              </p>
               {/* Display sentence-level processing error if any */}
               {sentence.error && <p className="text-xs text-red-500 mt-1">Processing Error: {sentence.error}</p>}
            </div>
          ))}
          {/* --- End map update --- */}
        </div>
      )}

      {/* Initial State Message */}
      {showInitialMessage && (
         <p className="text-stone-500">Enter text above and click "Process Text" to see results.</p>
      )}

      {/* CSS for hover effect & furigana positioning */}
      <style jsx global>{`
        .kanji-hover {
          cursor: pointer;
          transition: background-color 0.2s ease-in-out;
        }
        .kanji-hover:hover {
           background-color: rgba(255, 235, 59, 0.5);
        }
        rt {
            font-size: 0.7em;
            position: relative;
            bottom: 3.5px; /* Adjusted value from user */
        }
        /* Basic styling for Tippy content if needed */
        .tippy-box[data-theme~='light'] {
          /* Example customization */
          /* color: #333; */
        }
      `}</style>
    </section>
  );
}

export default OutputDisplay;
