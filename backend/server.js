// backend/server.js

require('dotenv').config(); // For loading GEMINI_API_KEY locally
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors'); // Require CORS package

// --- Initialize Gemini Client ---
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("ERROR: GEMINI_API_KEY is not set. Check .env file or environment variables.");
  // Optionally exit in production if key is absolutely required at start
  // process.exit(1);
}
// Initialize lazily or handle potential errors if key is missing
let model;
try {
    const genAI = new GoogleGenerativeAI(apiKey || "DUMMY_KEY"); // Use dummy if missing locally to avoid crash
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    if (!apiKey) {
        console.warn("Warning: GEMINI_API_KEY not found. Using dummy key for initialization. API calls will likely fail.");
    }
} catch (initError) {
    console.error("Error initializing Gemini client:", initError);
    // Handle error appropriately, maybe prevent server start or set model to null
}


const app = express();
// Use the PORT environment variable provided by the hosting platform, or 3001 locally
const port = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors()); // *** ADD THIS LINE: Enable CORS for all origins ***
app.use(express.json()); // Middleware to parse JSON bodies

// --- API Endpoints ---
app.get('/', (req, res) => {
  res.send('Hello from the Japanese Processor Backend! 👋');
});

app.post('/api/process-text', async (req, res) => {
  console.log('Received request to /api/process-text');

  // Check if model initialized correctly
   if (!model || !apiKey) { // Also check if apiKey was actually set
     console.error("Gemini model not initialized or API key missing.");
     return res.status(500).json({ error: "Internal Server Error: AI model not configured or API key missing." });
   }

  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.log('Bad Request: No text provided.');
    return res.status(400).json({ error: 'No text provided in the request body.' });
  }
  console.log('Processing text:', text); // Log might still be garbled in some terminals

  try {
    const sentences = text.match(/[^。！？]+[。！？]?/g) || [text];
    console.log(`Split into ${sentences.length} sentences.`);
    const results = [];
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length === 0) continue;
      console.log(`Processing sentence: "${trimmedSentence}"`);
      const prompt = `
          You are an assistant that processes Japanese text for language learners.
          For the given Japanese input sentence, provide ONLY a valid JSON object (no other text, explanations, or markdown formatting) with the following keys:
          - "original": The original Japanese sentence.
          - "furigana_html": The Japanese sentence with furigana added for all applicable kanji using HTML ruby tags (<ruby>Kanji<rt>Reading</rt></ruby>). Do not add furigana for hiragana or katakana. Ensure the output is a single string containing the HTML.
          - "translation": A natural English translation of the sentence.

          Input Sentence:
          "${trimmedSentence}"

          JSON Output:
        `;
      try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const responseText = response.text();
        let parsedJson;
        try {
          const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
          const jsonString = jsonMatch ? jsonMatch[1] : responseText;
          parsedJson = JSON.parse(jsonString);
          if (parsedJson && parsedJson.original && parsedJson.furigana_html && parsedJson.translation) {
            console.log(`Successfully processed sentence: "${parsedJson.original}"`);
            results.push(parsedJson);
          } else {
            console.error('Error: Gemini response missing expected JSON fields.', parsedJson);
            results.push({ original: trimmedSentence, furigana_html: trimmedSentence, translation: "[Translation Error]", error: "Invalid JSON structure from API" });
          }
        } catch (parseError) {
          console.error('Error parsing JSON response from Gemini:', parseError);
          console.error('Raw Gemini response text:', responseText);
          results.push({ original: trimmedSentence, furigana_html: trimmedSentence, translation: "[Translation Error]", error: "Failed to parse API response" });
        }
      } catch (apiError) {
        console.error('Error calling Gemini API for sentence:', trimmedSentence, apiError);
        results.push({ original: trimmedSentence, furigana_html: trimmedSentence, translation: "[Translation Error]", error: "API call failed" });
      }
    }
    console.log(`Finished processing. Sending ${results.length} results.`);
    res.status(200).json({ processedSentences: results });
  } catch (error) {
    console.error('Unexpected error processing text:', error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// --- Start the Server ---
app.listen(port, () => {
  // Log the actual port the server is listening on
  console.log(`✨ Backend server is running on port ${port}`);
});
