// This file runs before Jest starts the tests
// Set up environment variables for testing
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.GEMINI_API_KEY = 'test-gemini-api-key';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';

// Mock the pg Pool to avoid actual database connections
jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn(),
    on: jest.fn(),
  };
  return { Pool: jest.fn(() => mockPool) };
});

// Mock the GoogleGenerativeAI to avoid actual API calls
jest.mock('@google/generative-ai', () => {
  const mockGenerateContent = jest.fn().mockResolvedValue({
    response: {
      text: jest.fn().mockReturnValue(JSON.stringify({
        original: 'こんにちは',
        furigana_html: '<ruby>今日<rt>きょう</rt></ruby>は',
        translation: 'Hello'
      }))
    }
  });

  const mockModel = {
    generateContent: mockGenerateContent
  };

  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue(mockModel)
    }))
  };
});

// Mock the google-auth-library
jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: jest.fn().mockReturnValue({
          sub: 'test-google-id',
          email: 'test@example.com',
          email_verified: true
        })
      })
    }))
  };
});
