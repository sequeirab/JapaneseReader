// backend/server.js (Using Gemini 2.0 Flash)

require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');

const Kuroshiro = require('kuroshiro').default;
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');
const JishoApi = require('unofficial-jisho-api');
const wanakana = require('wanakana'); // Import wanakana

const { supermemo } = require('supermemo');

const jisho = new JishoApi();

// --- Initialize SQLite DB ---
const dbPath = process.env.DB_PATH || './japanese_reader.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ SQLite database connected successfully.');
    initializeDatabase();
  }
});

// --- Initialize Database Tables ---
function initializeDatabase() {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      google_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating users table:', err.message);
    else console.log('✅ Users table ready.');
  });

  // Create user_kanji_srs table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_kanji_srs (
      user_id INTEGER NOT NULL,
      kanji_character TEXT NOT NULL,
      interval REAL DEFAULT 0,
      repetition INTEGER DEFAULT 0,
      efactor REAL DEFAULT 2.5,
      due_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, kanji_character),
      FOREIGN KEY (user_id) REFERENCES users (user_id)
    )
  `, (err) => {
    if (err) console.error('Error creating user_kanji_srs table:', err.message);
    else console.log('✅ SRS table ready.');
  });
}

// --- Initialize Gemini Client ---
const apiKey = process.env.GEMINI_API_KEY;
let model;
try {
    if (!apiKey) throw new Error("API Key missing");
    const genAI = new GoogleGenerativeAI(apiKey);
    // --- UPDATED MODEL IDENTIFIER ---
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    // --- END UPDATE ---
    console.log("✅ Gemini client initialized successfully with model: gemini-2.0-flash");
} catch (initError) {
    console.error("❌ Error initializing Gemini client:", initError.message);
    // Attempt fallback or log more specific error if model name is invalid for this library
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

// --- Initialize Kuroshiro (Only needed for furigana HTML & kana conversion) ---
let kuroshiro; // The Kuroshiro instance
let isKuroshiroReady = false;
async function initializeKuroshiro() {
    try {
        kuroshiro = new Kuroshiro(); // Assign to instance variable
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
  optionsSuccessStatus: 200,
  allowedHeaders: ['Content-Type', 'Authorization'],
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
    if (!user || !user.userId) { // Make sure payload has expected data
        console.error("JWT payload missing userId");
        return res.sendStatus(403); // Forbidden (malformed payload)
    }
    req.user = user; // Attach user payload to request
    next(); // Proceed to the next middleware or route handler
  });
};

// --- API Endpoints ---
app.get('/', (req, res) => {
  res.send('Hello from the Japanese Processor Backend! 👋');
});

// --- Text Processing Endpoint (Simplified - No Tokenizer) ---
app.post('/api/process-text', authenticateToken, async (req, res) => {
  console.log('Received request to /api/process-text');

  // Check readiness
  if (!model || !apiKey) {
     return res.status(500).json({ error: "Internal Server Error: AI model not configured." });
  }
  if (!isKuroshiroReady || !kuroshiro) { // Check the instance variable
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
        let furiganaHtml = trimmedSentence;
        let kanjiDetailsMap = {};
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

                    if (result && result.found) {
                        let onyomiHiragana = [];
                        if (result.onyomi && result.onyomi.length > 0) {
                            onyomiHiragana = result.onyomi.map(onReading =>
                                wanakana.toHiragana(onReading) // Use wanakana
                            );
                        }

                        kanjiDetailsMap[char] = {
                            uri: result.uri,
                            meanings: result.meaning ? result.meaning.split(', ') : [],
                            readings_on: onyomiHiragana,
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
                        console.warn(`Kanji '${char}' not found via Jisho API. Found flag: ${result ? result.found : 'N/A'}`);
                        kanjiDetailsMap[char] = null;
                    }
                } catch (lookupErr) {
                    console.error(`Error object during lookup for Kanji '${char}':`, lookupErr);
                    console.error(`Error looking up Kanji '${char}' with Jisho API:`, lookupErr.message);
                    kanjiDetailsMap[char] = { error: `Jisho API lookup failed: ${lookupErr.message}` };
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
                // Ensure model is valid before calling
                 if (!model) throw new Error("Gemini model not initialized correctly.");
                const result = await model.generateContent(prompt);
                const response = result.response;
                translation = response.text().trim();
                console.log(`Gemini generated translation for: "${trimmedSentence}"`);
            } catch (geminiError) {
                console.error('Error calling Gemini API for translation:', trimmedSentence, geminiError);
                translation = "[Translation API Error]";
            }

        } catch (processingError) {
            console.error('Error processing sentence:', trimmedSentence, processingError);
            sentenceProcessingError = processingError.message || "Sentence processing failed";
            if (furiganaHtml === trimmedSentence) furiganaHtml = trimmedSentence;
        }

        // 3. Assemble Result for this sentence (Simplified Structure)
        processedSentences.push({
            original_sentence: trimmedSentence,
            furigana_html: furiganaHtml,
            translation: translation,
            kanji_details_map: kanjiDetailsMap,
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
    
    const newUserQuery = 'INSERT INTO users(email, password_hash) VALUES(?, ?)';
    
    db.run(newUserQuery, [lowerCaseEmail, passwordHash], function(err) {
      if (err) {
        console.error('Registration error:', err);
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Email already exists.' });
        }
        return res.status(500).json({ error: 'Registration failed.' });
      }
      
      const userId = this.lastID;
      console.log('User registered:', lowerCaseEmail);
      res.status(201).json({
        message: 'User registered successfully!',
        user: { userId: userId, email: lowerCaseEmail }
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
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
    const findUserQuery = 'SELECT user_id, email, password_hash FROM users WHERE email = ?';
    
    db.get(findUserQuery, [email.toLowerCase()], async (err, user) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Login failed.' });
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      
      try {
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
      } catch (bcryptError) {
        console.error('Bcrypt error:', bcryptError);
        res.status(500).json({ error: 'Login failed.' });
      }
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
      
      const findByGoogleIdQuery = 'SELECT user_id, email FROM users WHERE google_id = ?';
      
      db.get(findByGoogleIdQuery, [googleId], (err, user) => {
        if (err) {
          console.error('Google Sign-In Error:', err);
          return res.status(500).json({ error: 'Google Sign-In failed.' });
        }
        
        if (user) {
          // User found by Google ID
          console.log('Google Sign-In: User found by Google ID:', user.email);
          const appPayload = { userId: user.user_id, email: user.email };
          const appToken = jwt.sign(appPayload, jwtSecret, { expiresIn: '1h' });
          return res.status(200).json({
              message: 'Google Sign-In successful!',
              token: appToken,
              user: { userId: user.user_id, email: user.email }
          });
        } else {
          // Check if user exists by email
          const findByEmailQuery = 'SELECT user_id, email, google_id FROM users WHERE email = ?';
          
          db.get(findByEmailQuery, [email.toLowerCase()], (err, existingUser) => {
            if (err) {
              console.error('Google Sign-In Error:', err);
              return res.status(500).json({ error: 'Google Sign-In failed.' });
            }
            
            if (existingUser) {
              // User exists by email
              if (!existingUser.google_id) {
                // Link Google ID to existing user
                console.log('Google Sign-In: Found user by email, linking Google ID:', existingUser.email);
                const linkGoogleIdQuery = 'UPDATE users SET google_id = ? WHERE user_id = ?';
                
                db.run(linkGoogleIdQuery, [googleId, existingUser.user_id], (err) => {
                  if (err) {
                    console.error('Google Sign-In Error linking Google ID:', err);
                    return res.status(500).json({ error: 'Google Sign-In failed.' });
                  }
                  
                  const appPayload = { userId: existingUser.user_id, email: existingUser.email };
                  const appToken = jwt.sign(appPayload, jwtSecret, { expiresIn: '1h' });
                  return res.status(200).json({
                      message: 'Google Sign-In successful!',
                      token: appToken,
                      user: { userId: existingUser.user_id, email: existingUser.email }
                  });
                });
              } else {
                // Check for Google ID mismatch
                if (existingUser.google_id !== googleId) {
                  console.error(`Security Alert: Email ${email} trying to log in with different Google ID.`);
                  return res.status(403).json({ error: "Account association mismatch." });
                }
                
                const appPayload = { userId: existingUser.user_id, email: existingUser.email };
                const appToken = jwt.sign(appPayload, jwtSecret, { expiresIn: '1h' });
                return res.status(200).json({
                    message: 'Google Sign-In successful!',
                    token: appToken,
                    user: { userId: existingUser.user_id, email: existingUser.email }
                });
              }
            } else {
              // Create new user
              console.log('Google Sign-In: Creating new user for email:', email);
              const createUserQuery = 'INSERT INTO users (email, google_id) VALUES (?, ?)';
              
              db.run(createUserQuery, [email.toLowerCase(), googleId], function(err) {
                if (err) {
                  console.error('Google Sign-In Error creating user:', err);
                  return res.status(500).json({ error: 'Google Sign-In failed.' });
                }
                
                const userId = this.lastID;
                console.log('Google Sign-In: New user created:', email);
                const appPayload = { userId: userId, email: email };
                const appToken = jwt.sign(appPayload, jwtSecret, { expiresIn: '1h' });
                return res.status(200).json({
                    message: 'Google Sign-In successful!',
                    token: appToken,
                    user: { userId: userId, email: email }
                });
              });
            }
          });
        }
      });
  } catch (error) {
      console.error('Google Sign-In Error:', error);
      if (error.message.includes("Token used T late") || error.message.includes("Invalid token signature")) {
           res.status(401).json({ error: 'Invalid or expired Google token.' });
      } else {
           res.status(500).json({ error: 'Google Sign-In failed.' });
      }
  }
});

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
    const currentSrsQuery = 'SELECT interval, repetition, efactor FROM user_kanji_srs WHERE user_id = ? AND kanji_character = ?';
    
    db.get(currentSrsQuery, [userId, kanji], (err, currentSrsData) => {
      if (err) {
        console.error(`Error fetching SRS data for ${kanji} (User ${userId}):`, err);
        return res.status(500).json({ error: 'Failed to process review.' });
      }

      // Initialize or parse item data
      let item = !currentSrsData
        ? { interval: 0, repetition: 0, efactor: 2.5 } // Defaults for first review
        : {
            interval: parseFloat(currentSrsData.interval) || 0,
            repetition: parseInt(currentSrsData.repetition, 10) || 0,
            efactor: parseFloat(currentSrsData.efactor) || 2.5
          };

      // Calculate next state using supermemo library
      const updatedSrs = supermemo(item, grade);

      // Calculate next due date
      const now = new Date();
      const nextDueDate = new Date(now);
      nextDueDate.setDate(now.getDate() + updatedSrs.interval);

      // Update database (UPSERT equivalent for SQLite)
      if (currentSrsData) {
        // Update existing record
        const updateQuery = `
          UPDATE user_kanji_srs 
          SET interval = ?, repetition = ?, efactor = ?, due_date = ?, last_reviewed_at = datetime('now'), updated_at = datetime('now')
          WHERE user_id = ? AND kanji_character = ?
        `;
        db.run(updateQuery, [updatedSrs.interval, updatedSrs.repetition, updatedSrs.efactor, nextDueDate.toISOString(), userId, kanji], (err) => {
          if (err) {
            console.error(`Error updating SRS data for ${kanji} (User ${userId}):`, err);
            return res.status(500).json({ error: 'Failed to process review.' });
          }
          
          console.log(`SRS updated for ${kanji} (User ${userId}): Grade=${grade}, Interval=${updatedSrs.interval}, EFactor=${updatedSrs.efactor.toFixed(2)}, Due=${nextDueDate.toISOString().split('T')[0]}`);
          res.status(200).json({ message: 'Review recorded successfully.' });
        });
      } else {
        // Insert new record
        const insertQuery = `
          INSERT INTO user_kanji_srs (user_id, kanji_character, interval, repetition, efactor, due_date, last_reviewed_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
        `;
        db.run(insertQuery, [userId, kanji, updatedSrs.interval, updatedSrs.repetition, updatedSrs.efactor, nextDueDate.toISOString()], (err) => {
          if (err) {
            console.error(`Error inserting SRS data for ${kanji} (User ${userId}):`, err);
            return res.status(500).json({ error: 'Failed to process review.' });
          }
          
          console.log(`SRS updated for ${kanji} (User ${userId}): Grade=${grade}, Interval=${updatedSrs.interval}, EFactor=${updatedSrs.efactor.toFixed(2)}, Due=${nextDueDate.toISOString().split('T')[0]}`);
          res.status(200).json({ message: 'Review recorded successfully.' });
        });
      }
    });

  } catch (error) {
    console.error(`Error processing review for ${kanji} (User ${userId}):`, error);
    res.status(500).json({ error: 'Failed to process review.' });
  }
});

app.post('/api/srs/add', authenticateToken, async (req, res) => {
  const userId = req.user.userId; // Get user ID from authenticated token
  const { kanji } = req.body; // Get Kanji character from request body

  // Validate input
  if (!kanji || typeof kanji !== 'string' || kanji.length !== 1 || !isKanji(kanji)) {
      return res.status(400).json({ error: 'Invalid Kanji character provided.' });
  }

  try {
      // Check if the kanji already exists for this user
      const checkQuery = 'SELECT 1 FROM user_kanji_srs WHERE user_id = ? AND kanji_character = ?';
      
      db.get(checkQuery, [userId, kanji], (err, existingRecord) => {
        if (err) {
          console.error(`Error checking existing Kanji '${kanji}' for user ${userId}:`, err);
          return res.status(500).json({ error: 'Failed to add Kanji to review queue.' });
        }
        
        if (existingRecord) {
          console.log(`Kanji '${kanji}' already exists in SRS for user ${userId}. No action taken.`);
          return res.status(200).json({ message: `Kanji '${kanji}' is already in your review queue.` });
        } else {
          // Insert new record
          const insertQuery = `
            INSERT INTO user_kanji_srs
              (user_id, kanji_character, interval, repetition, efactor, due_date, last_reviewed_at, created_at, updated_at)
            VALUES
              (?, ?, 0, 0, 2.5, datetime('now'), NULL, datetime('now'), datetime('now'))
          `;
          
          db.run(insertQuery, [userId, kanji], function(err) {
            if (err) {
              console.error(`Error adding Kanji '${kanji}' to SRS for user ${userId}:`, err);
              // Handle potential foreign key constraint errors
              if (err.message.includes('FOREIGN KEY constraint failed')) {
                return res.status(404).json({ error: 'User not found.' });
              }
              return res.status(500).json({ error: 'Failed to add Kanji to review queue.' });
            }
            
            console.log(`Kanji '${kanji}' added to SRS for user ${userId}`);
            res.status(201).json({ message: `Kanji '${kanji}' added to your review queue.` });
          });
        }
      });

  } catch (error) {
      console.error(`Error adding Kanji '${kanji}' to SRS for user ${userId}:`, error);
      res.status(500).json({ error: 'Failed to add Kanji to review queue.' });
  }
});

app.get('/api/srs/due', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  try {
    const dueQuery = `
      SELECT kanji_character, interval, repetition, efactor, due_date, last_reviewed_at, created_at
      FROM user_kanji_srs 
      WHERE user_id = ? AND due_date <= datetime('now')
      ORDER BY due_date ASC
    `;
    
    db.all(dueQuery, [userId], (err, dueCards) => {
      if (err) {
        console.error(`Error fetching due cards for user ${userId}:`, err);
        return res.status(500).json({ error: 'Failed to fetch due cards.' });
      }
      
      console.log(`Fetched ${dueCards.length} due cards for user ${userId}`);
      res.status(200).json({ dueCards });
    });
  } catch (error) {
    console.error(`Error fetching due cards for user ${userId}:`, error);
    res.status(500).json({ error: 'Failed to fetch due cards.' });
  }
});

app.get('/api/srs/stats', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_cards,
        COUNT(CASE WHEN due_date <= datetime('now') THEN 1 END) as due_today,
        COUNT(CASE WHEN due_date <= datetime('now', '+1 day') THEN 1 END) as due_tomorrow,
        COUNT(CASE WHEN due_date <= datetime('now', '+7 days') THEN 1 END) as due_this_week,
        COUNT(CASE WHEN last_reviewed_at IS NOT NULL THEN 1 END) as reviewed_cards,
        AVG(CASE WHEN last_reviewed_at IS NOT NULL THEN efactor END) as avg_efactor,
        MAX(repetition) as max_repetition,
        COUNT(CASE WHEN last_reviewed_at >= datetime('now', '-1 day') THEN 1 END) as reviewed_today
      FROM user_kanji_srs 
      WHERE user_id = ?
    `;
    
    db.get(statsQuery, [userId], (err, stats) => {
      if (err) {
        console.error(`Error fetching stats for user ${userId}:`, err);
        return res.status(500).json({ error: 'Failed to fetch statistics.' });
      }
      
      console.log(`Fetched stats for user ${userId}`);
      res.status(200).json({ 
        stats: {
          totalCards: stats.total_cards || 0,
          dueToday: stats.due_today || 0,
          dueTomorrow: stats.due_tomorrow || 0,
          dueThisWeek: stats.due_this_week || 0,
          reviewedCards: stats.reviewed_cards || 0,
          avgEfactor: stats.avg_efactor ? parseFloat(stats.avg_efactor.toFixed(2)) : null,
          maxRepetition: stats.max_repetition || 0,
          reviewedToday: stats.reviewed_today || 0
        }
      });
    });
  } catch (error) {
    console.error(`Error fetching stats for user ${userId}:`, error);
    res.status(500).json({ error: 'Failed to fetch statistics.' });
  }
});

app.get('/api/srs/queue', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { sortBy = 'due_date', order = 'ASC', limit } = req.query;
  
  // Validate sort parameters
  const validSortFields = ['due_date', 'created_at', 'last_reviewed_at', 'repetition', 'efactor', 'kanji_character'];
  const validOrders = ['ASC', 'DESC'];
  
  if (!validSortFields.includes(sortBy) || !validOrders.includes(order.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid sort parameters.' });
  }
  
  try {
    let queueQuery = `
      SELECT kanji_character, interval, repetition, efactor, due_date, last_reviewed_at, created_at
      FROM user_kanji_srs 
      WHERE user_id = ?
      ORDER BY ${sortBy} ${order.toUpperCase()}
    `;
    
    const queryParams = [userId];
    
    if (limit && !isNaN(parseInt(limit))) {
      queueQuery += ' LIMIT ?';
      queryParams.push(parseInt(limit));
    }
    
    db.all(queueQuery, queryParams, (err, queue) => {
      if (err) {
        console.error(`Error fetching queue for user ${userId}:`, err);
        return res.status(500).json({ error: 'Failed to fetch review queue.' });
      }
      
      console.log(`Fetched ${queue.length} cards from queue for user ${userId}`);
      res.status(200).json({ queue });
    });
  } catch (error) {
    console.error(`Error fetching queue for user ${userId}:`, error);
    res.status(500).json({ error: 'Failed to fetch review queue.' });
  }
});

app.delete('/api/srs/remove/:kanji', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const kanji = req.params.kanji;
  
  // Validate Kanji
  if (typeof kanji !== 'string' || kanji.length !== 1 || !isKanji(kanji)) {
    return res.status(400).json({ error: 'Invalid Kanji character provided.' });
  }
  
  try {
    const deleteQuery = 'DELETE FROM user_kanji_srs WHERE user_id = ? AND kanji_character = ?';
    
    db.run(deleteQuery, [userId, kanji], function(err) {
      if (err) {
        console.error(`Error removing Kanji '${kanji}' for user ${userId}:`, err);
        return res.status(500).json({ error: 'Failed to remove Kanji from review queue.' });
      }
      
      if (this.changes === 0) {
        console.log(`Kanji '${kanji}' not found in queue for user ${userId}`);
        return res.status(404).json({ error: 'Kanji not found in your review queue.' });
      }
      
      console.log(`Kanji '${kanji}' removed from SRS for user ${userId}`);
      res.status(200).json({ message: `Kanji '${kanji}' removed from your review queue.` });
    });
  } catch (error) {
    console.error(`Error removing Kanji '${kanji}' for user ${userId}:`, error);
    res.status(500).json({ error: 'Failed to remove Kanji from review queue.' });
  }
});

// --- Start the Server ---
app.listen(port, () => {
  console.log(`✨ Backend server is running on port ${port}`);
});

// Export the app for testing purposes
module.exports = { app };
