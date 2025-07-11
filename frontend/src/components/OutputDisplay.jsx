// src/components/OutputDisplay.jsx
// (Modified to add onClick handler to Kanji spans)
import React, { useCallback, useState } from 'react';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// --- KanjiTooltipContent (Displays content *inside* the hover tooltip) ---
// (This remains the same as before, included for completeness)
function KanjiTooltipContent({ details, kanjiChar }) {
  const [onExpanded, setOnExpanded] = useState(false);
  const [kunExpanded, setKunExpanded] = useState(false);

  if (!details) return `Loading...`;
  if (details.error) return `Error: ${details.error}`;

  const formatMeanings = (meanings) => (meanings && meanings.length > 0 ? meanings.slice(0, 3).join(', ') : 'N/A');
  const INITIAL_READINGS_COUNT = 2;
  const onReadings = details.readings_on || [];
  const kunReadings = details.readings_kun || [];
  const showOnExpand = onReadings.length > INITIAL_READINGS_COUNT;
  const showKunExpand = kunReadings.length > INITIAL_READINGS_COUNT;
  const displayedOnReadings = onExpanded ? onReadings : onReadings.slice(0, INITIAL_READINGS_COUNT);
  const displayedKunReadings = kunExpanded ? kunReadings : kunReadings.slice(0, INITIAL_READINGS_COUNT);
  const toggleOn = (e) => { e.stopPropagation(); setOnExpanded(!onExpanded); }
  const toggleKun = (e) => { e.stopPropagation(); setKunExpanded(!kunExpanded); }
  const Expander = ({ onClick, isExpanded }) => (
    <span onClick={onClick} className="text-blue-400 hover:text-blue-300 cursor-pointer ml-1" title={isExpanded ? "Show less" : "Show more"}>
      {isExpanded ? ' [-]' : ' [+]'}
    </span>
  );

  return (
    <div className="text-left max-w-xs">
      <h4 className="font-bold text-xl mb-1">{kanjiChar}</h4>
      {details.meanings && details.meanings.length > 0 && (
        <p className="text-sm mb-1"><strong>Meanings:</strong> {formatMeanings(details.meanings)}</p>
      )}
      <div className="text-sm mb-1">
        <div>
            <strong>On:</strong> {displayedOnReadings.join(', ') || 'N/A'}
            {showOnExpand && <Expander onClick={toggleOn} isExpanded={onExpanded} />}
        </div>
        <div className="mt-1">
            <strong>Kun:</strong> {displayedKunReadings.join(', ') || 'N/A'}
            {showKunExpand && <Expander onClick={toggleKun} isExpanded={kunExpanded} />}
        </div>
      </div>
      <div className="text-xs mt-2">
        {details.jlpt && <span>JLPT: {details.jlpt}</span>}
        {details.grade && <span className="ml-2">Grade: {details.grade}</span>}
      </div>
       {details.uri && (
            <a href={details.uri} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 hover:underline mt-2 block">
                View on Jisho.org →
            </a>
        )}
    </div>
  );
}
// --- End KanjiTooltipContent ---


// --- Main OutputDisplay Component ---
// Added handleKanjiClick prop
function OutputDisplay({ processedData, isLoading, error, handleKanjiClick }) {
  const [bulkAddState, setBulkAddState] = useState({
    isAdding: false,
    message: '',
    success: false
  });

  const getAuthToken = () => {
    const token = localStorage.getItem('authToken');
    return import.meta.env.DEV && !token ? 'dev-dummy-token' : token;
  };

  const extractAllKanji = useCallback(() => {
    if (!processedData || processedData.length === 0) return [];
    
    const allKanji = new Set();
    processedData.forEach(sentence => {
      if (sentence.kanji_details_map) {
        Object.keys(sentence.kanji_details_map).forEach(kanji => {
          // Only add kanji that have valid details (not errors)
          if (sentence.kanji_details_map[kanji] && !sentence.kanji_details_map[kanji].error) {
            allKanji.add(kanji);
          }
        });
      }
    });
    return Array.from(allKanji);
  }, [processedData]);

  const bulkAddToSrs = async () => {
    const kanjiList = extractAllKanji();
    if (kanjiList.length === 0) {
      setBulkAddState({
        isAdding: false,
        message: 'No kanji found to add.',
        success: false
      });
      return;
    }

    setBulkAddState({
      isAdding: true,
      message: `Adding ${kanjiList.length} kanji...`,
      success: false
    });

    const token = getAuthToken();
    if (!token && !import.meta.env.DEV) {
      setBulkAddState({
        isAdding: false,
        message: 'Error: You must be logged in.',
        success: false
      });
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Add kanji one by one (could be optimized with a bulk endpoint)
    for (const kanji of kanjiList) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/srs/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ kanji }),
        });

        const data = await response.json();

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
          errors.push(`${kanji}: ${data.error || 'Unknown error'}`);
        }
      } catch (err) {
        errorCount++;
        errors.push(`${kanji}: ${err.message}`);
      }
    }

    // Set final message
    let message = '';
    if (successCount > 0 && errorCount === 0) {
      message = `Successfully added ${successCount} kanji to your review queue!`;
    } else if (successCount > 0 && errorCount > 0) {
      message = `Added ${successCount} kanji. ${errorCount} failed.`;
    } else {
      message = `Failed to add kanji. ${errors.slice(0, 3).join(', ')}`;
    }

    setBulkAddState({
      isAdding: false,
      message,
      success: successCount > 0
    });

    // Clear message after 5 seconds
    setTimeout(() => {
      setBulkAddState(prev => ({ ...prev, message: '' }));
    }, 5000);
  };

  // Modified renderFurigana to include onClick handler on the Kanji span
  const renderFurigana = useCallback((htmlString, kanjiDetailsMap) => {
    if (!htmlString) return null; // Return null if no HTML string is provided

    // Regular expression to identify Kanji characters
    const kanjiRegex = /[\u4E00-\u9FAF\u3400-\u4DBF]/;
    // Regular expression to find <ruby> tags generated by Kuroshiro
    // It captures the base text (group 1) and the ruby text (group 2)
    const rubyRegex = /<ruby>([^<]+)(?:<rp>.*?<\/rp>)?<rt>(.*?)<\/rt>(?:<rp>.*?<\/rp>)?<\/ruby>/gs;

    const parts = []; // Array to hold React elements and strings
    let lastIndex = 0; // Keep track of the end position of the last match
    let match; // Variable to hold the result of regex execution

    // Loop through all <ruby> tags found in the htmlString
    while ((match = rubyRegex.exec(htmlString)) !== null) {
      // Add the text segment before the current <ruby> tag, if any
      if (match.index > lastIndex) {
        parts.push(htmlString.substring(lastIndex, match.index));
      }

      const baseText = match[1]; // The text inside <ruby> (e.g., "今日")
      const rubyText = match[2]; // The text inside <rt> (e.g., "きょう")

      // Process the base text character by character
      const baseElements = baseText.split('').map((char, index) => {
        // Check if the character is a Kanji
        if (kanjiRegex.test(char)) {
          // Get the details for this specific Kanji from the map passed down
          const details = kanjiDetailsMap ? kanjiDetailsMap[char] : null;

          // Wrap the Kanji character in a Tippy component for the hover tooltip
          // AND a span with an onClick handler for the modal
          return (
            <Tippy
              key={`${match.index}-base-${index}-tippy`} // Unique key for React
              content={<KanjiTooltipContent details={details} kanjiChar={char} />} // Content for the tooltip
              allowHTML={true} // Allow HTML in tooltip content
              placement="top" // Tooltip position - changed to top for better visibility
              animation="fade" // Tooltip animation
              duration={[200, 150]} // Show/hide duration - slightly longer for better UX
              interactive={true} // Allow interaction (clicking links) within the tooltip
              zIndex={9999} // Ensure tooltip appears on top
              appendTo={() => document.body} // Append to body to avoid z-index issues
              offset={[0, 10]} // Add some offset for better positioning
            >
              {/* This span wraps the Kanji visually and handles the CLICK */}
              <span
                className="kanji-hover" // Class for hover styling (defined in CSS)
                onClick={() => handleKanjiClick(char, details)} // *** ADDED onClick handler ***
                                                               // Calls the function passed from App.jsx
              >
                {char} {/* The Kanji character itself */}
              </span>
            </Tippy>
          );
        } else {
          // If it's not a Kanji, just return the character as is
          return char;
        }
      });

      // Add the reconstructed <ruby> element with interactive Kanji spans
      parts.push(
        <ruby key={match.index}> {/* Unique key for React */}
          {baseElements} {/* The base text, potentially with wrapped Kanji */}
          <rt>{rubyText}</rt> {/* The furigana reading */}
        </ruby>
      );

      // Update lastIndex to the end of the current match
      lastIndex = rubyRegex.lastIndex;
    }

    // Add any remaining text after the last <ruby> tag
    if (lastIndex < htmlString.length) {
      parts.push(htmlString.substring(lastIndex));
    }

    // Return the array of elements/strings, or the original string if no ruby tags were found
    return parts.length > 0 ? parts : [htmlString];

  }, [handleKanjiClick]); // Add handleKanjiClick as a dependency for useCallback


  // Determine current display state (loading, error, results, or initial)
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
        <div className="space-y-6">
          {/* Modern Bulk Add to SRS Section */}
          <div className="relative overflow-hidden bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 border border-orange-200/60 rounded-2xl p-6 shadow-lg">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-200/30 to-yellow-200/30 rounded-full -translate-y-16 translate-x-16"></div>
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">📚</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-orange-800 mb-1">漢字をSRSに追加</h3>
                  <p className="text-sm text-orange-600/80">
                    Found <span className="font-semibold">{extractAllKanji().length}</span> unique kanji in this text
                  </p>
                </div>
              </div>
              
              <button
                onClick={bulkAddToSrs}
                disabled={bulkAddState.isAdding || extractAllKanji().length === 0}
                className={`group relative px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 transform ${
                  bulkAddState.isAdding || extractAllKanji().length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:scale-105 hover:shadow-lg hover:shadow-orange-500/25'
                }`}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {bulkAddState.isAdding ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      ➕ Add All to SRS
                    </>
                  )}
                </span>
                {!bulkAddState.isAdding && extractAllKanji().length > 0 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-amber-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                )}
              </button>
            </div>
            
            {bulkAddState.message && (
              <div className={`mt-4 p-3 rounded-xl transition-all duration-300 ${
                bulkAddState.success 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{bulkAddState.success ? '✅' : '⚠️'}</span>
                  <span className="font-medium">{bulkAddState.message}</span>
                </div>
              </div>
            )}
          </div>

          {/* Beautiful Sentence Cards */}
          {processedData.map((sentence, index) => (
            <div key={index} className="group relative bg-white/90 backdrop-blur-xl rounded-2xl border border-white/40 shadow-xl overflow-hidden transition-all duration-500 hover:shadow-2xl hover:scale-[1.02]">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-100/30 to-purple-100/30 rounded-full -translate-y-20 translate-x-20 transition-all duration-500 group-hover:scale-110"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-pink-100/30 to-yellow-100/30 rounded-full translate-y-16 -translate-x-16 transition-all duration-500 group-hover:scale-110"></div>
              
              <div className="relative p-8">
                {/* Sentence number badge */}
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg">
                  {index + 1}
                </div>
                
                {/* Japanese text with enhanced styling */}
                <div className="mb-6">
                  <p className="text-3xl mb-4 text-slate-800 leading-relaxed font-medium tracking-wide">
                    {renderFurigana(sentence.furigana_html || sentence.original_sentence, sentence.kanji_details_map)}
                  </p>
                </div>
                
                {/* Translation with modern styling */}
                <div className="relative">
                  <div className="flex items-start gap-3">
                    <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
                    <p className="text-lg text-slate-700 italic leading-relaxed">
                      {sentence.translation || '[No Translation Provided]'}
                    </p>
                  </div>
                </div>
                
                {/* Error display with improved styling */}
                {sentence.error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-red-500">⚠️</span>
                      <p className="text-sm text-red-600 font-medium">
                        Processing Error: {sentence.error}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Initial State Message */}
      {showInitialMessage && (
         <p className="text-stone-500">Enter text above and click "Process Text" to see results.</p>
      )}

      {/* --- Modern Enhanced Tooltip & Ruby Styles --- */}
      <style jsx global>{`
        .kanji-hover {
          cursor: pointer;
          transition: all 0.3s ease;
          border-radius: 8px;
          padding: 2px 4px;
          margin: 0 1px;
          position: relative;
          display: inline-block;
        }
        .kanji-hover:hover {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(147, 51, 234, 0.15));
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
        }
        .kanji-hover:active {
          transform: scale(1.05);
        }
        
        rt { 
          font-size: 0.7em;
          position: relative;
          bottom: 3.5px;
          color: #64748b;
          font-weight: 500;
        }
        
        /* Modern Tippy.js Tooltip Theme */
        .tippy-box {
          background: linear-gradient(135deg, #1e293b, #334155);
          color: #f1f5f9;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 0.9rem;
          line-height: 1.5;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04);
          backdrop-filter: blur(12px);
          z-index: 9999 !important;
          position: relative;
        }
        
        .tippy-popper {
          z-index: 9999 !important;
        }
        
        .tippy-content { 
          padding: 16px 20px;
          border-radius: 16px;
        }
        
        .tippy-arrow { 
          color: #1e293b;
        }
        
        .tippy-content h4 { 
          color: #f8fafc;
          margin-bottom: 0.75rem;
          font-size: 1.5rem;
          font-weight: 700;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .tippy-content p { 
          margin-bottom: 0.5rem;
          color: #e2e8f0;
          font-weight: 400;
        }
        
        .tippy-content strong { 
          color: #cbd5e1;
          font-weight: 600;
          margin-right: 0.5em;
        }
        
        .tippy-content .text-xs { 
          color: #94a3b8;
          display: block;
          margin-top: 0.75rem;
          font-size: 0.8rem;
        }
        
        .tippy-content a { 
          color: #60a5fa;
          font-weight: 500;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        
        .tippy-content a:hover { 
          color: #93c5fd;
          text-decoration: underline;
        }
        
        .tippy-content .text-blue-400 { 
          color: #60a5fa;
          transition: color 0.2s ease;
        }
        
        .tippy-content .hover\\:text-blue-300:hover { 
          color: #93c5fd;
        }
        
        .tippy-content .cursor-pointer { 
          cursor: pointer;
        }
        
        /* Smooth animations for tooltip */
        .tippy-box[data-animation="fade"][data-state="hidden"] {
          opacity: 0;
          transform: scale(0.8);
        }
        
        .tippy-box[data-animation="fade"][data-state="visible"] {
          opacity: 1;
          transform: scale(1);
        }
        
        /* Loading state enhancements */
        @keyframes kanji-pulse {
          0%, 100% { 
            background-color: rgba(148, 163, 184, 0.1);
          }
          50% { 
            background-color: rgba(148, 163, 184, 0.2);
          }
        }
        
        .kanji-loading {
          animation: kanji-pulse 1.5s ease-in-out infinite;
        }
        
        /* Ensure parent containers don't hide tooltips */
        .group {
          isolation: auto;
        }
        
        /* Override any overflow hidden that might clip tooltips */
        section {
          overflow: visible !important;
        }
      `}</style>
    </section>
  );
}

export default OutputDisplay;
