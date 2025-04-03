import { afterEach, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock API responses
const handlers = [
  // Auth endpoints
  http.post('*/auth/login', () => {
    return HttpResponse.json({
      message: 'Login successful!',
      token: 'mock-jwt-token',
      user: { userId: '123', email: 'test@example.com' }
    });
  }),
  
  http.post('*/auth/register', () => {
    return HttpResponse.json({
      message: 'User registered successfully!',
      user: { userId: '123', email: 'test@example.com' }
    });
  }),
  
  http.post('*/auth/google', () => {
    return HttpResponse.json({
      message: 'Google Sign-In successful!',
      token: 'mock-jwt-token',
      user: { userId: '123', email: 'test@example.com' }
    });
  }),
  
  // Text processing endpoint
  http.post('*/api/process-text', () => {
    return HttpResponse.json({
      processedSentences: [
        {
          original: 'こんにちは',
          furigana_html: '<ruby>今日<rt>きょう</rt></ruby>は',
          translation: 'Hello'
        }
      ]
    });
  })
];

const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Close server after all tests
afterAll(() => server.close());

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});
