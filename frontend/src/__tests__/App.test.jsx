import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

// Mock the child components to simplify testing
vi.mock('../components/Header', () => ({
  default: () => <div data-testid="mock-header">Header Component</div>
}));

vi.mock('../components/TextInput', () => ({
  default: ({ inputText, setInputText, handleProcessText, isLoading }) => (
    <div data-testid="mock-text-input">
      <textarea
        data-testid="mock-textarea"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
      />
      <button
        data-testid="mock-process-button"
        onClick={handleProcessText}
        disabled={isLoading}
      >
        {isLoading ? 'Processing...' : 'Process Text'}
      </button>
    </div>
  )
}));

vi.mock('../components/OutputDisplay', () => ({
  default: ({ processedData, isLoading, error }) => (
    <div data-testid="mock-output-display">
      {isLoading && <p>Loading...</p>}
      {error && <p data-testid="error-message">{error}</p>}
      {!isLoading && !error && processedData.length === 0 && (
        <p>No data</p>
      )}
      {!isLoading && !error && processedData.length > 0 && (
        <div data-testid="processed-data">
          {processedData.map((item, index) => (
            <div key={index}>
              <p>{item.original}</p>
              <p>{item.translation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}));

vi.mock('../components/AuthForms', () => ({
  default: ({ handleLogin, handleRegister, showLogin, setShowLogin, authError, isLoading }) => (
    <div data-testid="mock-auth-forms">
      <p>{showLogin ? 'Login Form' : 'Register Form'}</p>
      {authError && <p data-testid="auth-error">{authError}</p>}
      <button
        data-testid="toggle-form-button"
        onClick={() => setShowLogin(!showLogin)}
      >
        Toggle Form
      </button>
      <button
        data-testid="login-button"
        onClick={() => handleLogin('test@example.com', 'password123')}
        disabled={isLoading}
      >
        Login
      </button>
      <button
        data-testid="register-button"
        onClick={() => handleRegister('test@example.com', 'password123')}
        disabled={isLoading}
      >
        Register
      </button>
    </div>
  )
}));

describe('App Component', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Reset fetch mocks
    vi.restoreAllMocks();
  });
  
  test('renders auth forms when not logged in', () => {
    render(<App />);
    
    expect(screen.getByTestId('mock-auth-forms')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-text-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-output-display')).not.toBeInTheDocument();
  });
  
  test('renders main app when logged in', () => {
    // Mock a valid JWT token
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE2MTY3NjY3MDIsImV4cCI6MTYxNjc3MDMwMn0.3sRFwfhV-GFyYZm9q8kJIAGDbJF3F-tP4jF5vRGWkbw';
    localStorage.setItem('authToken', mockToken);
    
    render(<App />);
    
    expect(screen.queryByTestId('mock-auth-forms')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('mock-output-display')).toBeInTheDocument();
  });
  
  test('handles login successfully', async () => {
    // Mock the fetch API for login
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        message: 'Login successful!',
        token: 'mock-jwt-token',
        user: { userId: '123', email: 'test@example.com' }
      })
    });
    
    render(<App />);
    
    // Click the login button in the mocked AuthForms component
    fireEvent.click(screen.getByTestId('login-button'));
    
    // Wait for the login process to complete
    await waitFor(() => {
      // Check if localStorage was updated
      expect(localStorage.getItem('authToken')).toBe('mock-jwt-token');
      
      // Check if the main app is now rendered
      expect(screen.getByTestId('mock-text-input')).toBeInTheDocument();
      expect(screen.getByTestId('mock-output-display')).toBeInTheDocument();
    });
  });
  
  test('handles login failure', async () => {
    // Mock the fetch API for login failure
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        error: 'Invalid credentials'
      })
    });
    
    render(<App />);
    
    // Click the login button in the mocked AuthForms component
    fireEvent.click(screen.getByTestId('login-button'));
    
    // Wait for the login process to complete
    await waitFor(() => {
      // Check if the auth error is displayed
      expect(screen.getByTestId('auth-error')).toBeInTheDocument();
      
      // Check if we're still on the login form
      expect(screen.getByTestId('mock-auth-forms')).toBeInTheDocument();
    });
  });
  
  test('handles text processing', async () => {
    // Mock a valid JWT token to start in logged-in state
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE2MTY3NjY3MDIsImV4cCI6MTYxNjc3MDMwMn0.3sRFwfhV-GFyYZm9q8kJIAGDbJF3F-tP4jF5vRGWkbw';
    localStorage.setItem('authToken', mockToken);
    
    // Mock the fetch API for text processing
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        processedSentences: [
          {
            original: 'こんにちは',
            furigana_html: '<ruby>今日<rt>きょう</rt></ruby>は',
            translation: 'Hello'
          }
        ]
      })
    });
    
    render(<App />);
    
    // Enter text in the textarea
    fireEvent.change(screen.getByTestId('mock-textarea'), {
      target: { value: 'こんにちは' }
    });
    
    // Click the process button
    fireEvent.click(screen.getByTestId('mock-process-button'));
    
    // Wait for the processing to complete
    await waitFor(() => {
      // Check if the processed data is displayed
      expect(screen.getByTestId('processed-data')).toBeInTheDocument();
    });
  });
  
  test('handles logout', () => {
    // Mock a valid JWT token to start in logged-in state
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE2MTY3NjY3MDIsImV4cCI6MTYxNjc3MDMwMn0.3sRFwfhV-GFyYZm9q8kJIAGDbJF3F-tP4jF5vRGWkbw';
    localStorage.setItem('authToken', mockToken);
    
    const { rerender } = render(<App />);
    
    // Find the logout button
    const logoutButton = screen.getByText('Logout');
    
    // Click the logout button
    fireEvent.click(logoutButton);
    
    // Force a re-render to see the changes
    rerender(<App />);
    
    // Check if localStorage was cleared
    expect(localStorage.getItem('authToken')).toBeNull();
    
    // Check if we're back to the login form
    expect(screen.getByTestId('mock-auth-forms')).toBeInTheDocument();
  });
});
