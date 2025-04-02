// src/components/OutputDisplay.jsx
import React from 'react'; // No useState needed here

function OutputDisplay({ processedData, isLoading, error }) {
  // Helper function to safely create HTML markup for dangerouslySetInnerHTML
  const createMarkup = (htmlString) => ({ __html: htmlString || '' });

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
              {/* Japanese text with Furigana */}
              <p
                className="text-2xl mb-2 text-stone-800 leading-relaxed"
                dangerouslySetInnerHTML={createMarkup(sentence.furigana_html || sentence.original)}
              />
              {/* Translation */}
              <p className="text-lg text-stone-700 italic mt-1">
                {sentence.translation || '[No Translation Provided]'}
              </p>
               {/* Display per-sentence processing errors if any */}
               {sentence.error && <p className="text-xs text-red-500 mt-1">Processing Error: {sentence.error}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Initial State Message */}
      {showInitialMessage && (
         <p className="text-stone-500">Enter text above and click "Process Text" to see results.</p>
      )}
    </section>
  );
}

export default OutputDisplay;
