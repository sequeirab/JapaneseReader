// backend/server.js (Using kanji.js & direct Kuromoji)

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
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji'); // Still needed for Kuroshiro init
const kanji = require('kanji.js'); // Import kanji.js library
const kuromoji = require('kuromoji'); // Import kuromoji directly

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

// --- Initialize Kuroshiro (only for utility functions now) ---
let kuroshiro;
let isKuroshiroReady = false;
async function initializeKuroshiro() {
    // We still init Kuroshiro to use its utility functions like kanaToHiragana
    // but we don't strictly need its analyzer instance for tokenization anymore.
    try {
        kuroshiro = new Kuroshiro();
        // Need to pass an analyzer instance even if we don't use its methods directly
        const analyzer = new KuromojiAnalyzer({ dictPath: 'node_modules/kuromoji/dict' });
        await kuroshiro.init(analyzer);
        isKuroshiroReady = true;
        console.log("✅ Kuroshiro initialized successfully (for utils).");
    } catch (kuroshiroError) {
        console.error("❌ Error initializing Kuroshiro:", kuroshiroError);
        kuroshiro = null;
    }
}

// --- Initialize Kuromoji Tokenizer ---
let kuromojiTokenizer;
let isKuromojiReady = false;
function initializeKuromoji() {
    console.log("⏳ Initializing Kuromoji tokenizer...");
    return new Promise((resolve, reject) => {
        kuromoji.builder({ dicPath: "node_modules/kuromoji/dict" })
            .build((err, tokenizer) => {
                if (err) {
                    console.error("❌ Error building Kuromoji tokenizer:", err);
                    kuromojiTokenizer = null;
                    isKuromojiReady = false;
                    reject(err);
                } else {
                    kuromojiTokenizer = tokenizer;
                    isKuromojiReady = true;
                    console.log("✅ Kuromoji tokenizer initialized successfully.");
                    resolve();
                }
            });
    });
}

// Initialize Kuroshiro and Kuromoji concurrently
Promise.all([initializeKuroshiro(), initializeKuromoji()]).then(() => {
    console.log("✅✅ All language processors initialized (Kuroshiro utils, Kuromoji tokenizer).");
}).catch(err => {
    console.error("❌ Error during initialization:", err);
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

// --- Text Processing Endpoint (Using direct Kuromoji) ---
app.post('/api/process-text', async (req, res) => {
  console.log('Received request to /api/process-text');

  // Check readiness
  if (!model || !apiKey) {
     return res.status(500).json({ error: "Internal Server Error: AI model not configured." });
  }
  // Check if Kuromoji tokenizer is ready
  if (!isKuromojiReady || !kuromojiTokenizer) {
     console.error("Kuromoji tokenizer not ready.");
     return res.status(500).json({ error: "Internal Server Error: Tokenizer not ready." });
  }
   // Check if Kuroshiro utils are ready (optional, only needed for kanaToHiragana)
   if (!isKuroshiroReady || !kuroshiro) {
     console.warn("Kuroshiro utils not ready, readings might be in Katakana.");
     // Allow processing to continue, but readings might be Katakana
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
            // 2a. Tokenize the sentence using the direct Kuromoji tokenizer
            // Note: kuromoji.tokenize is synchronous
            const tokens = kuromojiTokenizer.tokenize(trimmedSentence);

            // 2b. Process each token
            for (const token of tokens) {
                const surface = token.surface_form;
                // Use reading from Kuromoji token, convert to Hiragana using Kuroshiro util if available
                let reading = token.reading || null;
                if (reading && kuroshiro) { // Check if kuroshiro is ready
                    reading = Kuroshiro.Util.kanaToHiragana(reading);
                } else if (reading) {
                    // If kuroshiro isn't ready, reading might be Katakana
                    console.warn(`Kuroshiro util not ready, keeping reading as: ${reading}`);
                }

                const containsKanji = surface.split('').some(isKanji);
                let kanjiDetails = {}; // Store details for unique Kanji in this token

                if (containsKanji) {
                    const uniqueKanjiInToken = [...new Set(surface.split('').filter(isKanji))];
                    for (const char of uniqueKanjiInToken) {
                        try {
                            const lookupResult = kanji.find(char);
                            if (lookupResult && typeof lookupResult === 'object') {
                                kanjiDetails[char] = {
                                    meanings: lookupResult.meaning ? lookupResult.meaning.split(',') : (lookupResult.meanings || []),
                                    readings_on: lookupResult.onyomi || [],
                                    readings_kun: lookupResult.kunyomi || [],
                                    stroke_count: lookupResult.stroke_count || null,
                                    grade: lookupResult.grade || null,
                                    jlpt: lookupResult.jlpt || null,
                                };
                            } else {
                                console.warn(`Kanji '${char}' not found or invalid result from kanji.js.`);
                                kanjiDetails[char] = null;
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
                    // Optional: Add part_of_speech: token.pos, etc. from Kuromoji if needed
                    pos: token.pos || null, // Example: adding part of speech
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
            // Catch errors from token processing or kanji lookup
            console.error('Error processing sentence segments:', trimmedSentence, processingError);
            sentenceProcessingError = processingError.message || "Segment processing failed";
            // Ensure segments array isn't completely empty if error occurred mid-processing
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
