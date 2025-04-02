// backend/server.js (Complete - Minimal Comments)

require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// --- Initialize DB Pool ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false } // Add if needed for Render internal connection
});

// --- Test DB Connection on Startup ---
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
    console.log("Gemini client initialized successfully.");
} catch (initError) {
    console.error("Error initializing Gemini client:", initError.message);
    model = null;
}

const app = express();
const port = process.env.PORT || 3001;

// --- Security Middleware ---
app.use(helmet()); // Set security-related HTTP headers

// CORS Configuration
const allowedOrigins = [
  'https://japanesereader.netlify.app', // Deployed frontend URL
  'http://localhost:5173',             // Local Vite dev server
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
app.use(cors(corsOptions)); // Use configured CORS

// Rate Limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per windowMs
	standardHeaders: true,
	legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use(limiter); // Apply rate limiting to all requests

// Body Parser
app.use(express.json()); // Parse JSON request bodies

// --- API Endpoints ---

// Root endpoint
app.get('/', (req, res) => {
  res.send('Hello from the Japanese Processor Backend! 👋');
});

// Gemini processing endpoint
app.post('/api/process-text', async (req, res) => {
  console.log('Received request to /api/process-text');
   if (!model || !apiKey) {
     console.error("Gemini model not initialized or API key missing.");
     return res.status(500).json({ error: "Internal Server Error: AI model not configured or API key missing." });
   }
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'No text provided in the request body.' });
  }
  console.log('Processing text length:', text.length); // Log length instead of full text

  try {
    const sentences = text.match(/[^。！？]+[。！？]?/g) || [text];
    const results = [];
    for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (trimmedSentence.length === 0) continue;
        // Construct prompt for Gemini
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
            // Basic validation
            if (parsedJson && parsedJson.original && parsedJson.furigana_html && parsedJson.translation) {
              results.push(parsedJson);
            } else {
              console.error('Error: Gemini response missing expected JSON fields.');
              results.push({ original: trimmedSentence, furigana_html: trimmedSentence, translation: "[Translation Error]", error: "Invalid JSON structure from API" });
            }
          } catch (parseError) {
             console.error('Error parsing JSON response from Gemini:', parseError);
             results.push({ original: trimmedSentence, furigana_html: trimmedSentence, translation: "[Translation Error]", error: "Failed to parse API response" });
           }
        } catch (apiError) {
            console.error('Error calling Gemini API for sentence:', apiError);
            results.push({ original: trimmedSentence, furigana_html: trimmedSentence, translation: "[Translation Error]", error: "API call failed" });
        }
    } // End sentence loop
    res.status(200).json({ processedSentences: results });
  } catch (error) {
      console.error('Unexpected error processing text:', error);
      res.status(500).json({ error: 'An internal server error occurred.' });
  }
});


// --- Authentication Endpoints ---

// Registration Endpoint
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Invalid input.' });
  }

  try {
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const lowerCaseEmail = email.toLowerCase();
    const newUserQuery = 'INSERT INTO users(email, password_hash) VALUES($1, $2) RETURNING user_id, email, created_at';
    const values = [lowerCaseEmail, passwordHash];

    const result = await pool.query(newUserQuery, values);
    const newUser = result.rows[0];

    console.log('User registered:', newUser.email);
    // Send limited user info back
    res.status(201).json({
        message: 'User registered successfully!',
        user: { userId: newUser.user_id, email: newUser.email }
    });

  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') { // Handle duplicate email
      return res.status(409).json({ error: 'Email already exists.' });
    }
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// Login Endpoint
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
    // Find user
    const findUserQuery = 'SELECT user_id, email, password_hash FROM users WHERE email = $1';
    const result = await pool.query(findUserQuery, [email.toLowerCase()]);
    const user = result.rows[0];

    if (!user) {
      // User not found
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Compare password hash
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      // Incorrect password
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT
    const payload = { userId: user.user_id, email: user.email };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' }); // Token expires in 1 hour

    console.log('User logged in:', user.email);
    // Send token and limited user info
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


// --- Start the Server ---
app.listen(port, () => {
  console.log(`✨ Backend server is running on port ${port}`);
});
