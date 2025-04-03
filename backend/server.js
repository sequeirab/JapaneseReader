// backend/server.js (Simplified - No Tokenizer, Jisho API for Chars)

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
// Removed direct kuromoji import
const JishoApi = require('unofficial-jisho-api');

const jisho = new JishoApi();

// --- Initialize DB Pool ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false }
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

// --- Initialize Kuroshiro (Only needed for furigana HTML now) ---
let kuroshiro;
let isKuroshiroReady = false;
async function initializeKuroshiro() {
    try {
        kuroshiro = new Kuroshiro();
        const analyzer = new KuromojiAnalyzer({ dictPath: 'node_modules/kuromoji/dict' });
        console.log("⏳ Initializing Kuroshiro (and its internal Kuromoji)...");
        await kuroshiro.init(analyzer);
        isKuroshiroReady = true;
        console.log("✅ Kuroshiro initialized successfully.");
    } catch (kuroshiroError) {
        console.error("❌ Error initializing Kuroshiro:", kuroshiroError);
        kuroshiro = null;
    }
}

// Initialize Kuroshiro
initializeKuroshiro().then(() => {
     if(isKuroshiroReady) {
        console.log("✅✅ Kuroshiro language processor initialized.");
     } else {
        console.error("⚠️ Kuroshiro initialization failed.");
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

// --- Text Processing Endpoint (Simplified - No Tokenizer) ---
app.post('/api/process-text', async (req, res) => {
  console.log('Received request to /api/process-text');

  // Check readiness
  if (!model || !apiKey) {
     return res.status(500).json({ error: "Internal Server Error: AI model not configured." });
  }
  if (!isKuroshiroReady || !kuroshiro) {
     console.error("Kuroshiro not ready.");
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
        let furiganaHtml = trimmedSentence; // Default if Kuroshiro fails
        let kanjiDetailsMap = {}; // Store details for unique Kanji in this sentence
        let sentenceProcessingError = null;

        try {
            // 2a. Generate Furigana HTML using Kuroshiro
            console.log("⏳ Generating furigana HTML...");
            furiganaHtml = await kuroshiro.convert(trimmedSentence, { mode: "furigana", to: "hiragana" });
            console.log("✅ Furigana HTML generated.");

            // 2b. Find unique Kanji characters in the sentence
            const uniqueKanjiInSentence = [...new Set(trimmedSentence.split('').filter(isKanji))];
            console.log(`Found unique Kanji: ${uniqueKanjiInSentence.join(', ')}`);

            // 2c. Look up details for each unique Kanji using Jisho API
            for (const char of uniqueKanjiInSentence) {
                try {
                    console.log(`Looking up Kanji '${char}' via Jisho API...`);
                    const result = await jisho.searchForKanji(char);
                    if (result && result.found && result.data) {
                        const data = result.data;
                        kanjiDetailsMap[char] = { // Store details keyed by the Kanji character
                            uri: result.uri,
                            meanings: data.meaning ? data.meaning.split(', ') : [],
                            readings_on: data.onyomi || [],
                            readings_kun: data.kunyomi || [],
                            stroke_count: data.stroke_count || null,
                            grade: data.grade || null,
                            jlpt: data.jlpt || null,
                            newspaper_frequency: data.newspaper_frequency || null,
                            taught_in: data.taught_in || null,
                            radical: data.radical ? data.radical.symbol : null,
                        };
                        console.log(`Found details for Kanji '${char}'`);
                    } else {
                        console.warn(`Kanji '${char}' not found via Jisho API.`);
                        kanjiDetailsMap[char] = null; // Indicate not found
                    }
                } catch (lookupErr) {
                    console.error(`Error looking up Kanji '${char}' with Jisho API:`, lookupErr);
                    kanjiDetailsMap[char] = { error: 'Jisho API lookup failed' };
                }
            } // End Kanji char loop

            // 2d. Get Translation using Gemini
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
            // Catch errors from Kuroshiro conversion or Jisho API lookup logic
            console.error('Error processing sentence:', trimmedSentence, processingError);
            sentenceProcessingError = processingError.message || "Sentence processing failed";
            // Use original sentence as furiganaHTML if conversion failed
            if (furiganaHtml === trimmedSentence) furiganaHtml = trimmedSentence;
        }

        // 3. Assemble Result for this sentence (Simplified Structure)
        processedSentences.push({
            original_sentence: trimmedSentence,
            furigana_html: furiganaHtml, // The HTML string with <ruby> tags
            translation: translation,
            kanji_details_map: kanjiDetailsMap, // Map of Kanji char -> details object
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
