// backend/server.js (Using kanji.js)

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
// Removed path and fs as Kanjidic XML file is no longer needed

const Kuroshiro = require('kuroshiro').default;
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');
const kanji = require('kanji.js'); // Import kanji.js library

// --- Initialize DB Pool ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false } // Add if needed
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
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    console.log("✅ Gemini client initialized successfully.");
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
let kuroshiroAnalyzer; // Keep analyzer instance for tokenization
let isKuroshiroReady = false;
async function initializeKuroshiro() {
    try {
        kuroshiro = new Kuroshiro();
        // Initialize with Kuromoji analyzer.
        kuroshiroAnalyzer = new KuromojiAnalyzer({ dictPath: 'node_modules/kuromoji/dict' });
        await kuroshiro.init(kuroshiroAnalyzer); // Pass the instance here
        isKuroshiroReady = true;
        console.log("✅ Kuroshiro initialized successfully.");
    } catch (kuroshiroError) {
        console.error("❌ Error initializing Kuroshiro:", kuroshiroError);
        // Ensure analyzer is null if init fails to prevent later errors
        kuroshiroAnalyzer = null;
        kuroshiro = null;
    }
}

// Initialize Kuroshiro
initializeKuroshiro().then(() => {
    if(isKuroshiroReady) {
      console.log("✅ Kuroshiro language processor initialized.");
    } else {
      console.error("⚠️ Kuroshiro initialization failed. Tokenization might not work.");
    }
}).catch(err => {
    console.error("❌ Error during Kuroshiro initialization:", err);
});


// --- Express App Setup ---
const app = express();
const port = process.env.PORT || 3001;

app.use(helmet());
const allowedOrigins = [
  'https://japanesereader.netlify.app',
  'http://localhost:5173',
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

// --- API Endpoints ---

app.get('/', (req, res) => {
  res.send('Hello from the Japanese Processor Backend! 👋');
});

// --- Text Processing Endpoint (REVISED for kanji.js) ---
app.post('/api/process-text', async (req, res) => {
  console.log('Received request to /api/process-text');

  // Check readiness
  if (!model || !apiKey) {
     return res.status(500).json({ error: "Internal Server Error: AI model not configured." });
  }
  // Ensure Kuroshiro AND its analyzer are ready before proceeding
  if (!isKuroshiroReady || !kuroshiro || !kuroshiroAnalyzer) {
     console.error("Kuroshiro or its analyzer not ready.");
     return res.status(500).json({ error: "Internal Server Error: Language processor not ready." });
  }

  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'No text provided.' });
  }
  console.log('Processing text length:', text.length);

  try {
    // 1. Split text into sentences
    const sentences = text.match(/[^。！？]+[。！？]?/g) || [text];
    const processedSentences = [];

    // 2. Process each sentence
    for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (trimmedSentence.length === 0) continue;
        console.log(`Processing sentence: "${trimmedSentence}"`);

        let translation = "[Translation Error]";
        let segments = [];
        let sentenceProcessingError = null;

        try {
            // 2a. Tokenize the sentence
            // --- FIX: Call tokenize directly on the analyzer instance ---
            const tokens = await kuroshiroAnalyzer.tokenize(trimmedSentence);
            // --- END FIX ---

            // 2b. Process each token
            for (const token of tokens) {
                const surface = token.surface_form;
                const reading = token.reading ? Kuroshiro.Util.kanaToHiragana(token.reading) : null;
                const containsKanji = surface.split('').some(isKanji);

                let kanjiDetails = {}; // Store details for unique Kanji in this token

                if (containsKanji) {
                    const uniqueKanjiInToken = [...new Set(surface.split('').filter(isKanji))];

                    // Look up details using kanji.js
                    for (const char of uniqueKanjiInToken) {
                        try {
                            // Use kanji.js find method (or appropriate method per library docs)
                            const lookupResult = kanji.find(char);
                            if (lookupResult && typeof lookupResult === 'object') {
                                // Extract relevant data - **adjust field names based on actual kanji.js output**
                                kanjiDetails[char] = {
                                    meanings: lookupResult.meaning ? lookupResult.meaning.split(',') : (lookupResult.meanings || []), // Adapt based on actual structure
                                    readings_on: lookupResult.onyomi || [], // Check actual field names
                                    readings_kun: lookupResult.kunyomi || [], // Check actual field names
                                    stroke_count: lookupResult.stroke_count || null,
                                    grade: lookupResult.grade || null,
                                    jlpt: lookupResult.jlpt || null,
                                    // Add other fields provided by kanji.js if needed
                                };
                            } else {
                                console.warn(`Kanji '${char}' not found or invalid result from kanji.js.`);
                                kanjiDetails[char] = null; // Indicate not found
                            }
                        } catch (lookupErr) {
                            console.error(`Error looking up Kanji '${char}' with kanji.js:`, lookupErr);
                            kanjiDetails[char] = { error: 'Lookup failed' };
                        }
                    }
                }

                // Add segment to the results
                segments.push({
                    text: surface,
                    is_kanji_token: containsKanji,
                    furigana: (reading && reading !== surface) ? reading : null,
                    kanji_details: Object.keys(kanjiDetails).length > 0 ? kanjiDetails : null,
                });
            } // End token loop

            // 2c. Get Translation using Gemini
            const prompt = `
                Translate the following Japanese sentence accurately into natural English.
                Return ONLY the English translation as a plain string, without any labels, quotes, or explanations.
                Input Sentence: "${trimmedSentence}"
                English Translation:
            `;
            try {
                const result = await model.generateContent(prompt);
                const response = result.response;
                translation = response.text().trim();
                console.log(`Gemini generated translation for: "${trimmedSentence}"`);
            } catch (geminiError) {
                console.error('Error calling Gemini API for translation:', trimmedSentence, geminiError);
                translation = "[Translation API Error]";
            }

        } catch (processingError) {
            console.error('Error processing sentence segments:', trimmedSentence, processingError);
            sentenceProcessingError = processingError.message || "Segment processing failed";
            if (segments.length === 0) {
                 segments.push({ text: trimmedSentence, is_kanji_token: false, furigana: null, kanji_details: null, error: sentenceProcessingError });
            }
        }

        // 3. Assemble Result for this sentence
        processedSentences.push({
            original_sentence: trimmedSentence,
            segments: segments,
            translation: translation,
            ...(sentenceProcessingError && { error: sentenceProcessingError })
        });

    } // End sentence loop

    // 4. Send overall response
    res.status(200).json({ processedSentences: processedSentences });

  } catch (error) {
      console.error('Unexpected error in /api/process-text:', error);
      res.status(500).json({ error: 'An internal server error occurred.' });
  }
});


// --- Authentication Endpoints (Keep existing code) ---
// ... ( /auth/register, /auth/login, /auth/google endpoints remain the same) ...
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Invalid input.' });
  }

  try {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const lowerCaseEmail = email.toLowerCase();
    const newUserQuery = 'INSERT INTO users(email, password_hash) VALUES($1, $2) RETURNING user_id, email, created_at';
    const values = [lowerCaseEmail, passwordHash];
    const result = await pool.query(newUserQuery, values);
    const newUser = result.rows[0];
    console.log('User registered:', newUser.email);
    res.status(201).json({
        message: 'User registered successfully!',
        user: { userId: newUser.user_id, email: newUser.email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists.' });
    }
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
      console.error("FATAL ERROR: JWT_SECRET environment variable is not set.");
      return res.status(500).json({ error: "Server configuration error." });
  }
  try {
    const findUserQuery = 'SELECT user_id, email, password_hash FROM users WHERE email = $1';
    const result = await pool.query(findUserQuery, [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const payload = { userId: user.user_id, email: user.email };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });
    console.log('User logged in:', user.email);
    res.status(200).json({
        message: 'Login successful!',
        token: token,
        user: { userId: user.user_id, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/auth/google', async (req, res) => {
  const { googleToken } = req.body;
  if (!googleToken) {
      return res.status(400).json({ error: "Google ID token is required." });
  }
  if (!GOOGLE_CLIENT_ID) {
      console.error("Google Client ID not configured on backend.");
      return res.status(500).json({ error: "Server configuration error." });
  }
  const jwtSecret = process.env.JWT_SECRET;
   if (!jwtSecret) {
       console.error("FATAL ERROR: JWT_SECRET environment variable is not set.");
       return res.status(500).json({ error: "Server configuration error." });
   }
  try {
      const ticket = await googleClient.verifyIdToken({
          idToken: googleToken,
          audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      const googleId = payload['sub'];
      const email = payload['email'];
      const emailVerified = payload['email_verified'];
      if (!email || !emailVerified) {
          return res.status(400).json({ error: "Google account email not verified." });
      }
      let user;
      let userId;
      const findByGoogleIdQuery = 'SELECT user_id, email FROM users WHERE google_id = $1';
      let result = await pool.query(findByGoogleIdQuery, [googleId]);
      user = result.rows[0];
      if (user) {
          userId = user.user_id;
          console.log('Google Sign-In: User found by Google ID:', user.email);
      } else {
          const findByEmailQuery = 'SELECT user_id, email, google_id FROM users WHERE email = $1';
          result = await pool.query(findByEmailQuery, [email.toLowerCase()]);
          user = result.rows[0];
          if (user) {
              userId = user.user_id;
              if (!user.google_id) {
                  console.log('Google Sign-In: Found user by email, linking Google ID:', user.email);
                  const linkGoogleIdQuery = 'UPDATE users SET google_id = $1 WHERE user_id = $2';
                  await pool.query(linkGoogleIdQuery, [googleId, userId]);
              } else {
                  console.log('Google Sign-In: User found by email (Google ID already linked):', user.email);
                  if (user.google_id !== googleId) {
                      console.error(`Security Alert: Email ${email} trying to log in with different Google ID.`);
                      return res.status(403).json({ error: "Account association mismatch." });
                  }
              }
          } else {
              console.log('Google Sign-In: Creating new user for email:', email);
              const createUserQuery = 'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING user_id, email';
              const values = [email.toLowerCase(), googleId];
              result = await pool.query(createUserQuery, values);
              user = result.rows[0];
              userId = user.user_id;
              console.log('Google Sign-In: New user created:', user.email);
          }
      }
      const appPayload = { userId: userId, email: user.email };
      const appToken = jwt.sign(appPayload, jwtSecret, { expiresIn: '1h' });
      res.status(200).json({
          message: 'Google Sign-In successful!',
          token: appToken,
          user: { userId: userId, email: user.email }
      });
  } catch (error) {
      console.error('Google Sign-In Error:', error);
      if (error.message.includes("Token used too late") || error.message.includes("Invalid token signature")) {
           res.status(401).json({ error: 'Invalid or expired Google token.' });
      } else {
           res.status(500).json({ error: 'Google Sign-In failed.' });
      }
  }
});


// --- Start the Server ---
app.listen(port, () => {
  console.log(`✨ Backend server is running on port ${port}`);
});

// Export the app for testing purposes
module.exports = { app };
