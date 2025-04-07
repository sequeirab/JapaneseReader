// src/components/OutputDisplay.jsx
import React, { useCallback, useState } from 'react'; // Added useState
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css'; // Import default Tippy CSS styles
// import 'tippy.js/themes/light.css'; // Optional theme

// --- Component to render formatted Kanji details with expandable readings ---
function KanjiTooltipContent({ details, kanjiChar }) {
  // State to track if readings lists are expanded
  const [onExpanded, setOnExpanded] = useState(false);
  const [kunExpanded, setKunExpanded] = useState(false);

  if (!details) {
    return `No details found for ${kanjiChar}.`;
  }
  if (details.error) {
    return `Error: ${details.error}`;
  }

  // Limit meanings to max 3
  const formatMeanings = (meanings) => (meanings && meanings.length > 0 ? meanings.slice(0, 3).join(', ') : 'N/A');

  // Constants for reading display
  const INITIAL_READINGS_COUNT = 2;
  const onReadings = details.readings_on || [];
  const kunReadings = details.readings_kun || [];

  // Determine if expansion buttons are needed
  const showOnExpand = onReadings.length > INITIAL_READINGS_COUNT;
  const showKunExpand = kunReadings.length > INITIAL_READINGS_COUNT;

  // Get readings to display based on expanded state
  const displayedOnReadings = onExpanded ? onReadings : onReadings.slice(0, INITIAL_READINGS_COUNT);
  const displayedKunReadings = kunExpanded ? kunReadings : kunReadings.slice(0, INITIAL_READINGS_COUNT);

  // Click handlers for expansion
  const toggleOn = (e) => {
      e.stopPropagation(); // Prevent tooltip from closing if interactive
      setOnExpanded(!onExpanded);
  }
   const toggleKun = (e) => {
      e.stopPropagation();
      setKunExpanded(!kunExpanded);
  }

  // Helper span for the expand/collapse links
  const Expander = ({ onClick, isExpanded }) => (
    <span
      onClick={onClick}
      className="text-blue-400 hover:text-blue-300 cursor-pointer ml-1"
      title={isExpanded ? "Show less" : "Show more"}
    >
      {isExpanded ? ' [-]' : ' [+]'}
      {/* Or use text: {isExpanded ? ' less' : ' ...more'} */}
    </span>
  );

  return (
    <div className="text-left max-w-xs">
      <h4 className="font-bold text-xl mb-1">{kanjiChar}</h4>
      {details.meanings && details.meanings.length > 0 && (
        <p className="text-sm mb-1"><strong>Meanings:</strong> {formatMeanings(details.meanings)}</p>
      )}
      {/* Readings Section */}
      <div className="text-sm mb-1">
        <div>
            <strong>On:</strong> {displayedOnReadings.join(', ') || 'N/A'}
            {showOnExpand && <Expander onClick={toggleOn} isExpanded={onExpanded} />}
        </div>
        <div className="mt-1"> {/* Add some space between On and Kun */}
            <strong>Kun:</strong> {displayedKunReadings.join(', ') || 'N/A'}
            {showKunExpand && <Expander onClick={toggleKun} isExpanded={kunExpanded} />}
        </div>
      </div>
      {/* Other Details Section */}
      <div className="text-xs mt-2">
        {details.jlpt && <span>JLPT: {details.jlpt}</span>}
        {details.grade && <span className="ml-2">Grade: {details.grade}</span>}
      </div>
       {details.uri && (
            <a
                href={details.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 hover:underline mt-2 block"
            >
                View on Jisho.org →
            </a>
        )}
    </div>
  );
}


// --- Main OutputDisplay Component (No changes needed here) ---
function OutputDisplay({ processedData, isLoading, error }) {

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
          const details = kanjiDetailsMap ? kanjiDetailsMap[char] : null;

          return (
            <Tippy
              key={`${match.index}-base-${index}-tippy`}
              content={<KanjiTooltipContent details={details} kanjiChar={char} />}
              allowHTML={true}
              placement="bottom"
              animation="fade"
              duration={[100, 100]}
              interactive={true} // Keep interactive true to allow clicking inside
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

  }, []);


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
                {renderFurigana(sentence.furigana_html || sentence.original_sentence, sentence.kanji_details_map)}
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

      {/* --- Enhanced Tooltip Styles --- */}
      <style jsx global>{`
        .kanji-hover {
          cursor: pointer;
          transition: background-color 0.2s ease-in-out;
          border-radius: 2px;
          padding: 0 1px;
          margin: 0 1px;
        }
        .kanji-hover:hover {
           background-color: rgba(255, 235, 59, 0.6);
        }
        rt {
            font-size: 0.7em;
            position: relative;
            bottom: 3.5px;
        }

        /* --- Custom Tippy.js Tooltip Theme --- */
        .tippy-box {
          background-color: #334155; /* Tailwind slate-800 */
          color: #cbd5e1; /* Tailwind slate-300 */
          border-radius: 6px;
          border-top: 2px solid #F97316; /* Tailwind orange-600 */
          border: none;
          font-size: 0.9rem;
          line-height: 1.4;
          font-family: 'Inter', sans-serif;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        }
        .tippy-content {
          padding: 10px 14px;
        }
        .tippy-arrow {
          color: #334155;
        }
        .tippy-content h4 {
          color: #FFF;
          margin-bottom: 0.5rem;
          font-size: 1.25rem;
        }
        .tippy-content p {
          margin-bottom: 0.4rem;
          color: #e2e8f0;
        }
        .tippy-content strong {
           color: #94a3b8;
           font-weight: 600;
           margin-right: 0.4em;
        }
        .tippy-content .text-xs {
           color: #94a3b8;
           display: block;
           margin-top: 0.5rem;
        }
        .tippy-content a {
          color: #60a5fa;
          font-weight: 500;
        }
        .tippy-content a:hover {
          color: #3b82f6;
        }
        /* Style for the expander */
        .tippy-content .text-blue-400 {
            color: #60a5fa; /* Ensure color applies */
        }
         .tippy-content .hover\\:text-blue-300:hover {
             color: #93c5fd; /* Ensure hover color applies */
         }
         .tippy-content .cursor-pointer {
             cursor: pointer;
         }
      `}</style>
      {/* --- End Enhanced Tooltip Styles --- */}
    </section>
  );
}

export default OutputDisplay;
