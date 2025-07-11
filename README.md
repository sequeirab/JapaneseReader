# 🇯🇵 Japanese Reader

A modern web application for Japanese language learning with AI-powered text processing, furigana generation, and spaced repetition system (SRS) for kanji memorization.

![Japanese Reader](./frontend/public/mt_fuji.png)

## ✨ Features

### 📖 Japanese Text Processing
- **AI Translation**: Powered by Google Gemini 2.0 Flash for accurate translations
- **Furigana Generation**: Automatic hiragana readings above kanji using Kuroshiro
- **Kanji Analysis**: Detailed information for each kanji including:
  - On'yomi and Kun'yomi readings
  - English meanings
  - Stroke count, JLPT level, grade level
  - Newspaper frequency ranking
  - Radical information

### 🧠 Spaced Repetition System (SRS)
- **Smart Learning**: SuperMemo algorithm for optimal review timing
- **Progress Tracking**: Individual kanji review intervals and difficulty
- **Personalized Queue**: Add kanji to your personal review collection
- **Review Sessions**: Dedicated SRS review interface

### 🔐 Authentication
- **Email/Password Registration**: Secure user account creation
- **Google OAuth Integration**: Quick sign-in with Google accounts
- **JWT Authentication**: Secure session management
- **Password Encryption**: bcrypt hashing for security

### 💾 Data Management
- **SQLite Database**: Lightweight, file-based database for local development
- **User Progress**: Individual SRS data tracking per user
- **Persistent Sessions**: Secure token-based authentication

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite3 (development) / PostgreSQL (production ready)
- **Authentication**: 
  - `jsonwebtoken` - JWT token generation and verification
  - `bcrypt` - Password hashing
  - `google-auth-library` - Google OAuth verification
- **Japanese Processing**:
  - `kuroshiro` + `kuroshiro-analyzer-kuromoji` - Furigana generation
  - `unofficial-jisho-api` - Kanji dictionary lookups
  - `wanakana` - Japanese text utilities
- **AI Integration**: `@google/generative-ai` - Gemini API client
- **SRS Algorithm**: `supermemo` - Spaced repetition calculations
- **Security**: 
  - `helmet` - Security headers
  - `cors` - Cross-origin resource sharing
  - `express-rate-limit` - API rate limiting

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Testing**: Vitest + Testing Library
- **OAuth**: `@react-oauth/google`
- **UI Components**: 
  - `lucide-react` - Icons
  - `@tippyjs/react` - Tooltips
- **Linting**: ESLint

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- Google Cloud Console account (for OAuth and Gemini API)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd JapaneseReader
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

### Environment Setup

1. **Backend Configuration** (`backend/.env`)
   ```env
   # Database
   DB_PATH=./japanese_reader.db
   
   # Google Gemini AI
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # JWT Security
   JWT_SECRET=your_secure_random_string_here
   
   # Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   
   # Server
   PORT=3001
   NODE_ENV=development
   ```

2. **Frontend Configuration** (`frontend/.env`)
   ```env
   # API Configuration
   VITE_API_BASE_URL=http://localhost:3001
   
   # Google OAuth
   VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   ```

### API Keys Setup

#### Google Gemini API
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add to `GEMINI_API_KEY` in backend `.env`

#### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Configure OAuth consent screen
5. Create OAuth 2.0 credentials with:
   - **Authorized JavaScript origins**: `http://localhost:5173`
   - **Authorized redirect URIs**: `http://localhost:5173`
6. Add Client ID and Secret to `.env` files

### Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   npm start
   ```
   Server runs on `http://localhost:3001`

2. **Start the frontend development server**
   ```bash
   cd frontend
   npm run dev
   ```
   Application available at `http://localhost:5173`

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Test Coverage
```bash
# Backend
cd backend
npm run test:coverage

# Frontend
cd frontend
npm run test:coverage
```

## 📱 Usage

1. **Create Account**: Register with email/password or sign in with Google
2. **Process Japanese Text**: 
   - Enter Japanese text in the input area
   - Click "Process Text" to get translations and furigana
3. **Study Kanji**: 
   - Click on any kanji to view detailed information
   - Add kanji to your SRS review queue
4. **Review Session**: 
   - Use the SRS tab to review your saved kanji
   - Rate your recall to update the review schedule

## 📁 Project Structure

```
JapaneseReader/
├── backend/
│   ├── __tests__/          # Backend tests
│   ├── japanese_reader.db  # SQLite database
│   ├── server.js          # Main server file
│   ├── package.json       # Backend dependencies
│   └── .env               # Backend environment variables
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── __tests__/     # Frontend tests
│   │   ├── App.jsx        # Main app component
│   │   └── main.jsx       # App entry point
│   ├── public/            # Static assets
│   ├── package.json       # Frontend dependencies
│   └── .env               # Frontend environment variables
└── README.md
```

## 🔒 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Secure token-based sessions
- **CORS Protection**: Configured for specific origins
- **Rate Limiting**: API request throttling
- **Input Validation**: Sanitization of user inputs
- **Security Headers**: Helmet.js protection

## 🎯 Core Dependencies

### Backend Core
- `express` - Web framework
- `sqlite3` - Database driver
- `jsonwebtoken` - JWT handling
- `bcrypt` - Password hashing
- `cors` - CORS middleware
- `helmet` - Security headers

### Japanese Processing
- `kuroshiro` - Furigana conversion
- `kuroshiro-analyzer-kuromoji` - Japanese morphological analysis
- `unofficial-jisho-api` - Kanji dictionary
- `wanakana` - Japanese text utilities

### AI & Algorithms
- `@google/generative-ai` - Gemini AI client
- `supermemo` - Spaced repetition algorithm

### Frontend Core
- `react` - UI library
- `react-dom` - DOM rendering
- `vite` - Build tool
- `tailwindcss` - CSS framework

## 🚀 Deployment

### Production Considerations

1. **Database**: Switch from SQLite to PostgreSQL for production
2. **Environment**: Update CORS origins for production domain
3. **SSL**: Enable HTTPS for OAuth callbacks
4. **Process Manager**: Use PM2 or similar for backend process management

### Environment Variables for Production
- Set `NODE_ENV=production`
- Use strong, unique JWT secrets
- Configure production database URLs
- Update Google OAuth redirect URIs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- **Jisho.org** - Japanese dictionary data
- **Google Gemini** - AI translation capabilities
- **Kuroshiro** - Furigana generation library
- **SuperMemo** - Spaced repetition algorithm

---

**Happy Japanese Learning! 🎌**