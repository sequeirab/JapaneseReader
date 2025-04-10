// backend/server.js (Using Gemini 2.0 Flash)

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

// --- NEW: Import the supermemo library ---
// Ensure you've run: npm install supermemo
const { supermemo } = require('supermemo'); // Adjust if the export is different

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
    if (initError.message.includes('model')) {
         console.error("⚠️ Possible invalid model name for Node.js library. Check documentation.");
    }
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
        // Ensure kuromoji dictionary path is correct relative to where server.js runs
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
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per windowMs
	standardHeaders: true,
	legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use(limiter);
app.use(express.json());

// --- Helper Function ---
const isKanji = (char) => /[\u4E00-\u9FAF\u3400-\u4DBF]/.test(char);

// --- JWT Authentication Middleware (Example - Adapt to your actual implementation) ---
// This middleware assumes you verify the JWT and attach user info to req.user
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) return res.sendStatus(401); // if there isn't any token

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
      console.error("FATAL ERROR: JWT_SECRET environment variable is not set.");
      return res.status(500).json({ error: "Server configuration error." });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
        console.log("JWT Verification Error:", err.message);
        return res.sendStatus(403); // invalid token
    }
    // IMPORTANT: Make sure the payload stored in the token has userId
    if (!user || !user.userId) {
        console.error("JWT payload missing userId");
        return res.sendStatus(403);
    }
    req.user = user; // Add user payload to request object
    next(); // pass the execution off to whatever request the client intended
  });
};
// --- End JWT Middleware Example ---


// --- API Endpoints ---
app.get('/', (req, res) => {
  res.send('Hello from the Japanese Processor Backend! 👋');
});

// --- Text Processing Endpoint (Simplified - No Tokenizer) ---
// Apply authentication middleware if this should be a protected route
app.post('/api/process-text',  authenticateToken, async (req, res) => {
  console.log('Received request to /api/process-text');
  // Check readiness
  if (!model || !apiKey) { return res.status(500).json({ error: "Internal Server Error: AI model not configured." }); }
  if (!isKuroshiroReady || !kuroshiro) { return res.status(500).json({ error: "Internal Server Error: Language processor not ready." }); }

  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) { return res.status(400).json({ error: 'No text provided.' }); }
  console.log('Processing text length:', text.length);

  try {
    const sentences = text.match(/[^。！？]+[。！？]?/g) || [text];
    const processedSentences = [];

    for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (trimmedSentence.length === 0) continue;
        console.log(`Processing sentence: "${trimmedSentence}"`);

        let translation = "[Translation Error]";
        let furiganaHtml = trimmedSentence;
        let kanjiDetailsMap = {};
        let sentenceProcessingError = null;

        try {
            // Generate Furigana HTML
            console.log("⏳ Generating furigana HTML...");
            furiganaHtml = await kuroshiro.convert(trimmedSentence, { mode: "furigana", to: "hiragana" });
            console.log("✅ Furigana HTML generated.");

            // Find unique Kanji and look up details
            const uniqueKanjiInSentence = [...new Set(trimmedSentence.split('').filter(isKanji))];
            console.log(`Found unique Kanji: ${uniqueKanjiInSentence.join(', ')}`);
            for (const char of uniqueKanjiInSentence) {
                try {
                    console.log(`Looking up Kanji '${char}' via Jisho API...`);
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
                        console.log(`Found details for Kanji '${char}'`);
                    } else {
                        console.warn(`Kanji '${char}' not found via Jisho API.`);
                        kanjiDetailsMap[char] = null; // Indicate not found
                    }
                } catch (lookupErr) {
                    console.error(`Error looking up Kanji '${char}' with Jisho API:`, lookupErr.message);
                    kanjiDetailsMap[char] = { error: `Jisho API lookup failed: ${lookupErr.message}` };
                }
            } // End Kanji char loop

            // Get Translation using Gemini
            const prompt = `Translate the following Japanese sentence accurately into natural English. Return ONLY the English translation as a plain string, without any labels, quotes, or explanations. Input Sentence: "${trimmedSentence}"\nEnglish Translation:`;
            try {
                 if (!model) throw new Error("Gemini model not initialized correctly.");
                const result = await model.generateContent(prompt);
                translation = result.response.text().trim();
                console.log(`Gemini generated translation for: "${trimmedSentence}"`);
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
app.post('/auth/register', async (req, res) => { /* ... Keep existing ... */
  const { email, password } = req.body;
  if (!email || !password || password.length < 6) { return res.status(400).json({ error: 'Invalid input.' }); }
  try {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const lowerCaseEmail = email.toLowerCase();
    const newUserQuery = 'INSERT INTO users(email, password_hash) VALUES($1, $2) RETURNING user_id, email, created_at';
    const result = await pool.query(newUserQuery, [lowerCaseEmail, passwordHash]);
    const newUser = result.rows[0];
    console.log('User registered:', newUser.email);
    res.status(201).json({ message: 'User registered successfully!', user: { userId: newUser.user_id, email: newUser.email } });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') { return res.status(409).json({ error: 'Email already exists.' }); }
    res.status(500).json({ error: 'Registration failed.' });
  }
});
app.post('/auth/login', async (req, res) => { /* ... Keep existing ... */
  const { email, password } = req.body;
  if (!email || !password) { return res.status(400).json({ error: 'Email and password are required.' }); }
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) { console.error("FATAL ERROR: JWT_SECRET not set."); return res.status(500).json({ error: "Server configuration error." }); }
  try {
    const findUserQuery = 'SELECT user_id, email, password_hash FROM users WHERE email = $1';
    const result = await pool.query(findUserQuery, [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) { return res.status(401).json({ error: 'Invalid email or password.' }); }
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) { return res.status(401).json({ error: 'Invalid email or password.' }); }
    const payload = { userId: user.user_id, email: user.email }; // Ensure payload matches middleware expectations
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });
    console.log('User logged in:', user.email);
    res.status(200).json({ message: 'Login successful!', token: token, user: { userId: user.user_id, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});
app.post('/auth/google', async (req, res) => { /* ... Keep existing ... */
  const { googleToken } = req.body;
  if (!googleToken) { return res.status(400).json({ error: "Google ID token is required." }); }
  if (!GOOGLE_CLIENT_ID) { console.error("Google Client ID not configured."); return res.status(500).json({ error: "Server configuration error." }); }
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) { console.error("FATAL ERROR: JWT_SECRET not set."); return res.status(500).json({ error: "Server configuration error." }); }
  try {
      const ticket = await googleClient.verifyIdToken({ idToken: googleToken, audience: GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      const googleId = payload['sub'];
      const email = payload['email'];
      const emailVerified = payload['email_verified'];
      if (!email || !emailVerified) { return res.status(400).json({ error: "Google account email not verified." }); }
      let user; let userId;
      let result = await pool.query('SELECT user_id, email FROM users WHERE google_id = $1', [googleId]);
      user = result.rows[0];
      if (user) { userId = user.user_id; console.log('Google Sign-In: User found by Google ID:', user.email); }
      else {
          result = await pool.query('SELECT user_id, email, google_id FROM users WHERE email = $1', [email.toLowerCase()]);
          user = result.rows[0];
          if (user) {
              userId = user.user_id;
              if (!user.google_id) {
                  console.log('Google Sign-In: Found user by email, linking Google ID:', user.email);
                  await pool.query('UPDATE users SET google_id = $1 WHERE user_id = $2', [googleId, userId]);
              } else if (user.google_id !== googleId) {
                  console.error(`Security Alert: Email ${email} trying to log in with different Google ID.`);
                  return res.status(403).json({ error: "Account association mismatch." });
              } else { console.log('Google Sign-In: User found by email (Google ID already linked):', user.email); }
          } else {
              console.log('Google Sign-In: Creating new user for email:', email);
              result = await pool.query('INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING user_id, email', [email.toLowerCase(), googleId]);
              user = result.rows[0]; userId = user.user_id;
              console.log('Google Sign-In: New user created:', user.email);
          }
      }
      const appPayload = { userId: userId, email: user.email }; // Ensure payload matches middleware expectations
      const appToken = jwt.sign(appPayload, jwtSecret, { expiresIn: '1h' });
      res.status(200).json({ message: 'Google Sign-In successful!', token: appToken, user: { userId: userId, email: user.email } });
  } catch (error) {
      console.error('Google Sign-In Error:', error);
      if (error.message.includes("Token used T late") || error.message.includes("Invalid token signature")) {
           res.status(401).json({ error: 'Invalid or expired Google token.' });
      } else { res.status(500).json({ error: 'Google Sign-In failed.' }); }
  }
});


