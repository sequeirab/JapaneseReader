// src/components/TextInput.jsx
import React from 'react'; // No useState needed here directly

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

export default TextInput;
