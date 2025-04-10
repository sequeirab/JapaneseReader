// backend/server.js (Standard Auth Flow)

require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');

const Kuroshiro = require('kuroshiro').default;
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');
const JishoApi = require('unofficial-jisho-api');
const wanakana = require('wanakana');
const { supermemo } = require('supermemo'); // For SRS

const jisho = new JishoApi();

// --- Initialize DB Pool ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false } // Uncomment if needed for hosted DB
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) { console.error('❌ Database connection error:', err.stack); }
  else { console.log('✅ Database connection successful.'); }
});

// --- Initialize Gemini Client ---
const apiKey = process.env.GEMINI_API_KEY;
let model;
try {
    if (!apiKey) throw new Error("API Key missing");
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    console.log("✅ Gemini client initialized successfully with model: gemini-2.0-flash");
} catch (initError) {
    console.error("❌ Error initializing Gemini client:", initError.message);
    model = null;
}

// --- Initialize Google Auth Client ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
if (!GOOGLE_CLIENT_ID) {
    console.error("FATAL ERROR: GOOGLE_CLIENT_ID environment variable is not set.");
}

// --- Initialize Kuroshiro ---
let kuroshiro;
let isKuroshiroReady = false;
async function initializeKuroshiro() {
    try {
        kuroshiro = new Kuroshiro();
        const analyzer = new KuromojiAnalyzer({ dictPath: 'node_modules/kuromoji/dict' });
        console.log("⏳ Initializing Kuroshiro...");
        await kuroshiro.init(analyzer);
        isKuroshiroReady = true;
        console.log("✅ Kuroshiro initialized successfully.");
    } catch (kuroshiroError) {
        console.error("❌ Error initializing Kuroshiro:", kuroshiroError);
        kuroshiro = null;
    }
}
initializeKuroshiro().then(() => { /* ... */ }).catch(err => { /* ... */ });


// --- Express App Setup ---
const app = express();
const port = process.env.PORT || 3001;
app.use(helmet());
const allowedOrigins = [
  'https://japanesereader.netlify.app', // Your frontend production URL
  'http://localhost:5173',              // Your frontend development URL
];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	standardHeaders: true,
	legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use(limiter);
app.use(express.json());

// --- Helper Function ---
const isKanji = (char) => /[\u4E00-\u9FAF\u3400-\u4DBF]/.test(char);

// --- JWT Authentication Middleware ---
// Verifies JWT and adds user info to req.user
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
      console.log('Auth Error: No token provided');
      return res.sendStatus(401); // Unauthorized
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
      console.error("FATAL ERROR: JWT_SECRET environment variable is not set.");
      return res.status(500).json({ error: "Server configuration error." });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
        console.log("JWT Verification Error:", err.message);
        return res.sendStatus(403); // Forbidden (invalid/expired token)
    }
    // IMPORTANT: Ensure the payload stored in the token has userId
    if (!user || !user.userId) {
        console.error("JWT payload missing userId");
        return res.sendStatus(403); // Forbidden (malformed payload)
    }
    req.user = user; // Attach user payload to request object
    next(); // Proceed to the next middleware or route handler
  });
};
// --- End JWT Middleware ---


// --- API Endpoints ---
app.get('/', (req, res) => {
  res.send('Hello from the Japanese Processor Backend! 👋');
});

// --- Text Processing Endpoint ---
// *** Authentication is REQUIRED ***
app.post('/api/process-text', authenticateToken, async (req, res) => {
  // req.user is guaranteed to exist here if middleware passed
  console.log(`Received request to /api/process-text from user: ${req.user.userId}`);

  // Readiness checks
  if (!model || !apiKey) { return res.status(500).json({ error: "Internal Server Error: AI model not configured." }); }
  if (!isKuroshiroReady || !kuroshiro) { return res.status(500).json({ error: "Internal Server Error: Language processor not ready." }); }

  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) { return res.status(400).json({ error: 'No text provided.' }); }
  console.log('Processing text length:', text.length);

  try {
    // (Keep the existing text processing logic inside the try block)
    const sentences = text.match(/[^。！？]+[。！？]?/g) || [text];
    const processedSentences = [];

    for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (trimmedSentence.length === 0) continue;
        // console.log(`Processing sentence: "${trimmedSentence}"`); // Optional: reduce logging

        let translation = "[Translation Error]";
        let furiganaHtml = trimmedSentence;
        let kanjiDetailsMap = {};
        let sentenceProcessingError = null;

        try {
            // Generate Furigana HTML
            furiganaHtml = await kuroshiro.convert(trimmedSentence, { mode: "furigana", to: "hiragana" });

            // Find unique Kanji and look up details
            const uniqueKanjiInSentence = [...new Set(trimmedSentence.split('').filter(isKanji))];
            for (const char of uniqueKanjiInSentence) {
                try {
                    const result = await jisho.searchForKanji(char);
                    if (result && result.found) {
                        kanjiDetailsMap[char] = {
                            uri: result.uri,
                            meanings: result.meaning ? result.meaning.split(', ') : [],
                            readings_on: (result.onyomi || []).map(r => wanakana.toHiragana(r)),
                            readings_kun: result.kunyomi || [],
                            stroke_count: result.strokeCount || null,
                            grade: result.grade || null,
                            jlpt: result.jlptLevel || null,
                            newspaper_frequency: result.newspaperFrequencyRank || null,
                            taught_in: result.taughtIn || null,
                            radical: result.radical ? result.radical.symbol : null,
                        };
                    } else {
                        kanjiDetailsMap[char] = null;
                    }
                } catch (lookupErr) {
                    console.error(`Error looking up Kanji '${char}':`, lookupErr.message);
                    kanjiDetailsMap[char] = { error: `Jisho API lookup failed: ${lookupErr.message}` };
                }
            } // End Kanji char loop

            // Get Translation using Gemini
            const prompt = `Translate the following Japanese sentence accurately into natural English. Return ONLY the English translation as a plain string, without any labels, quotes, or explanations. Input Sentence: "${trimmedSentence}"\nEnglish Translation:`;
            try {
                 if (!model) throw new Error("Gemini model not initialized correctly.");
                const result = await model.generateContent(prompt);
                translation = result.response.text().trim();
            } catch (geminiError) {
                console.error('Error calling Gemini API for translation:', trimmedSentence, geminiError);
                translation = "[Translation API Error]";
            }

        } catch (processingError) {
            console.error('Error processing sentence:', trimmedSentence, processingError);
            sentenceProcessingError = processingError.message || "Sentence processing failed";
        }

        // Assemble Result for this sentence
        processedSentences.push({
            original_sentence: trimmedSentence,
            furigana_html: furiganaHtml,
            translation: translation,
            kanji_details_map: kanjiDetailsMap,
            ...(sentenceProcessingError && { error: sentenceProcessingError })
        });
    } // End sentence loop

    res.status(200).json({ processedSentences: processedSentences });

  } catch (error) {
      console.error('Unexpected error in /api/process-text:', error);
      res.status(500).json({ error: 'An internal server error occurred.' });
  }
});


// --- Authentication Endpoints ---
// (No changes needed here)
app.post('/auth/register', async (req, res) => { /* ... */ });
app.post('/auth/login', async (req, res) => { /* ... */ });
app.post('/auth/google', async (req, res) => { /* ... */ });

// --- SRS Review Endpoint ---
// *** Authentication is REQUIRED ***
// *** Removed temporary bypass comment and mock req.user ***
app.post('/api/srs/review/:kanji', authenticateToken, async (req, res) => {
  // req.user is guaranteed to exist here if middleware passed
  const userId = req.user.userId;
  const kanji = req.params.kanji;
  const { grade } = req.body;

  // Validate grade
  if (grade === undefined || typeof grade !== 'number' || grade < 0 || grade > 5) {
    return res.status(400).json({ error: 'Invalid review grade provided (must be 0-5).' });
  }
  // Validate Kanji
  if (typeof kanji !== 'string' || kanji.length !== 1 || !isKanji(kanji)) {
      return res.status(400).json({ error: 'Invalid Kanji character provided.' });
  }

  try {
    // Fetch current SRS data
    const currentSrsData = await pool.query(
      'SELECT interval, repetition, efactor FROM user_kanji_srs WHERE user_id = $1 AND kanji_character = $2',
      [userId, kanji]
    );

    // Initialize or parse item data
    let item = (currentSrsData.rows.length === 0)
      ? { interval: 0, repetition: 0, efactor: 2.5 } // Defaults for first review
      : {
          interval: parseFloat(currentSrsData.rows[0].interval) || 0,
          repetition: parseInt(currentSrsData.rows[0].repetition, 10) || 0,
          efactor: parseFloat(currentSrsData.rows[0].efactor) || 2.5
        };

    // Calculate next state using supermemo library
    const updatedSrs = supermemo(item, grade);

    // Calculate next due date
    const now = new Date();
    const nextDueDate = new Date(now);
    nextDueDate.setDate(now.getDate() + updatedSrs.interval);

    // Update database (UPSERT)
    const upsertQuery = `
      INSERT INTO user_kanji_srs (user_id, kanji_character, interval, repetition, efactor, due_date, last_reviewed_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id, kanji_character)
      DO UPDATE SET interval = EXCLUDED.interval, repetition = EXCLUDED.repetition, efactor = EXCLUDED.efactor, due_date = EXCLUDED.due_date, last_reviewed_at = NOW(), updated_at = NOW();
    `;
    await pool.query(upsertQuery, [ userId, kanji, updatedSrs.interval, updatedSrs.repetition, updatedSrs.efactor, nextDueDate ]);

    console.log(`SRS updated for ${kanji} (User ${userId}): Grade=${grade}, Interval=${updatedSrs.interval}, EFactor=${updatedSrs.efactor.toFixed(2)}, Due=${nextDueDate.toISOString().split('T')[0]}`);
    res.status(200).json({ message: 'Review recorded successfully.' });

  } catch (error) {
    console.error(`Error processing review for ${kanji} (User ${userId}):`, error);
    res.status(500).json({ error: 'Failed to process review.' });
  }
});

// --- Add other SRS endpoints later (e.g., fetching due items) ---
// app.get('/api/srs/due', authenticateToken, async (req, res) => { ... });
// app.post('/api/srs/add', authenticateToken, async (req, res) => { ... });


// --- Start the Server ---
app.listen(port, () => {
  console.log(`✨ Backend server is running on port ${port}`);
});

// Export the app for testing purposes (if needed)
module.exports = { app };
