// src/components/TextInput.jsx
import React from 'react';

function TextInput({ inputText, setInputText, handleProcessText, isLoading }) {
  return (
    // Main wrapper with relative positioning for the SVG frame
    <div className="relative px-4 py-6 torii-input-container"> {/* Adjust padding as needed */}

      {/* SVG Gate Frame */}
      <div className="absolute inset-0 z-0 pointer-events-none"> {/* Positioned behind content, fills container */}
        {/*
          ---> PASTE YOUR SVG CODE HERE <---

          Example structure (replace with your actual SVG code):
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 150" // Adjust viewBox based on your SVG's coordinates
            preserveAspectRatio="xMidYMid meet" // Adjust scaling behavior if needed
            className="w-full h-full" // Make SVG fill the container div
          >
            {/* Your <path>, <rect>, <g> etc. elements go here *\/}
            {/* Example path - replace with your actual gate paths *\/}
            <path d="M10 140 L10 30 L50 30 L50 20 L150 20 L150 30 L190 30 L190 140 Z M0 10 L200 10 L180 0 L20 0 Z"
                  fill="#B91C1C" // Example fill color (Tailwind red-700) - Style as needed
                  stroke="#000" // Example stroke color
                  strokeWidth="1"
            />
            {/* Add more paths/elements for beams, details etc. *\/}
          </svg>

          ---> END OF SVG CODE PLACEHOLDER <---
        */}
      </div>

      {/* Input Section - Positioned above the SVG */}
      <section className="relative z-10"> {/* Ensure content is above the SVG (z-10) */}
        <label htmlFor="japanese-text" className="block text-lg font-semibold mb-2 text-stone-700">
          Enter Japanese text:
        </label>
        <textarea
          id="japanese-text"
          rows="4"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          // Added slight transparency to see background if needed, adjust/remove
          className="w-full p-3 border border-stone-400 rounded-md focus:ring-2 focus:ring-orange-600 focus:border-transparent resize-none bg-white/90 placeholder-gray-500 shadow-sm"
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

      {/* Remove the old <style jsx> block for the CSS gate attempt */}

    </div> // End torii-input-container
  );
}

export default TextInput;
