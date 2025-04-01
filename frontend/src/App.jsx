// src/App.jsx (Regenerated Version)
import React, { useState } from 'react';

// Main App Component
function App() {
  // State variables
  const [inputText, setInputText] = useState('');
  // Initialize processedData to empty array
  const [processedData, setProcessedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Backend API URL (Make sure your Node.js backend is running at this address)
  const API_URL = 'http://localhost:3001/api/process-text';

  // Function to handle the API call
  const handleProcessText = async () => {
    if (!inputText.trim()) {
      setError('Please enter some Japanese text.');
      setProcessedData([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    setProcessedData([]); // Clear previous results
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP error! Status: ${response.status}` }));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.processedSentences) {
         setProcessedData(data.processedSentences);
      } else {
         console.error("Unexpected response structure:", data);
         throw new Error("Received unexpected data structure from backend.");
      }
    } catch (err) {
      console.error('API call failed:', err);
      setError(err.message || 'Failed to connect to the backend or process the text.');
    } finally {
      setIsLoading(false);
    }
  };

  // Main layout using standard Tailwind colors
  return (
    <div className="min-h-screen bg-orange-50 text-stone-800 font-sans p-4 sm:p-8 flex flex-col items-center">
      <Header />
      <main className="w-full max-w-4xl bg-white/60 backdrop-blur-sm rounded-lg shadow-md p-6 mt-6 border border-stone-300/30">
        <TextInput
          inputText={inputText}
          setInputText={setInputText}
          handleProcessText={handleProcessText}
          isLoading={isLoading}
        />
        <hr className="my-6 border-t border-stone-300" />
        <OutputDisplay
          processedData={processedData}
          isLoading={isLoading}
          error={error}
        />
      </main>
       <footer className="mt-8 text-center text-stone-500 text-sm">
         Created with React & Gemini
       </footer>
    </div>
  );
}

// Header Component
function Header() {
  return (
    <header className="text-center mb-6">
      {/* TODO: Add Torii gate icon */}
      <h1 className="text-3xl sm:text-4xl font-bold text-stone-700">
        Japanese Reader
      </h1>
    </header>
  );
}

// Text Input Component
function TextInput({ inputText, setInputText, handleProcessText, isLoading }) {
  return (
    <section>
      <label htmlFor="japanese-text" className="block text-lg font-semibold mb-2 text-stone-700">
        Enter Japanese text:
      </label>
      <textarea
        id="japanese-text"
        rows="4"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        className="w-full p-3 border border-stone-300 rounded-md focus:ring-2 focus:ring-orange-600 focus:border-transparent resize-none bg-white/80 placeholder-gray-500"
        placeholder="ここに日本語のテキストを入力してください..."
        disabled={isLoading}
      />
      <button
        onClick={handleProcessText}
        disabled={isLoading || !inputText.trim()}
        className={`mt-4 px-6 py-2 rounded-md text-white font-semibold transition-all duration-200 ease-in-out shadow focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 focus:ring-offset-orange-50 ${
          isLoading || !inputText.trim()
            ? 'bg-orange-600/50 cursor-not-allowed'
            : 'bg-orange-600 hover:bg-orange-700 active:scale-95'
        }`}
      >
        {isLoading ? 'Processing...' : 'Process Text'}
      </button>
    </section>
  );
}

// Output Display Component - **EVEN LARGER FONT SIZES**
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
              {/* Japanese text with Furigana - Increased to text-2xl */}
              <p
                className="text-2xl mb-2 text-stone-800 leading-relaxed" 
                dangerouslySetInnerHTML={createMarkup(sentence.furigana_html || sentence.original)}
              />
              {/* Translation - Increased to text-lg */}
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

// Export the main App component
export default App;
