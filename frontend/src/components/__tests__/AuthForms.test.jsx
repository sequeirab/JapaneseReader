import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuthForms from '../AuthForms';

describe('AuthForms Component', () => {
  const defaultProps = {
    showLogin: true,
    setShowLogin: vi.fn(),
    handleLogin: vi.fn(),
    handleRegister: vi.fn(),
    authError: '',
    isLoading: false,
    setAuthToken: vi.fn(),
    setCurrentUser: vi.fn(),
    setAuthError: vi.fn(),
    setIsAuthLoading: vi.fn()
  };
  
  test('renders login form when showLogin is true', () => {
    render(<AuthForms {...defaultProps} />);
    
    expect(screen.getByText(/log in to your account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });
  
  test('renders register form when showLogin is false', () => {
    render(<AuthForms {...defaultProps} showLogin={false} />);
    
    expect(screen.getByText(/create an account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });
  
  test('toggles between login and register forms', () => {
    render(<AuthForms {...defaultProps} />);
    
    // Initially shows login form
    expect(screen.getByText(/log in to your account/i)).toBeInTheDocument();
    
    // Click the register link
    fireEvent.click(screen.getByText(/need an account/i));
    expect(defaultProps.setShowLogin).toHaveBeenCalledWith(false);
    
    // Simulate showing register form
    render(<AuthForms {...defaultProps} showLogin={false} />);
    
    // Now shows register form
    expect(screen.getByText(/create an account/i)).toBeInTheDocument();
    
    // Click the login link
    fireEvent.click(screen.getByText(/already have an account/i));
    expect(defaultProps.setShowLogin).toHaveBeenCalledWith(true);
  });
  
  test('submits login form with credentials', () => {
    render(<AuthForms {...defaultProps} />);
    
    // Fill in the form
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    
    // Check if handleLogin was called with the correct credentials
    expect(defaultProps.handleLogin).toHaveBeenCalledWith('test@example.com', 'password123');
  });
  
  test('submits register form with credentials', () => {
    render(<AuthForms {...defaultProps} showLogin={false} />);
    
    // Fill in the form
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    
    // Check if handleRegister was called with the correct credentials
    expect(defaultProps.handleRegister).toHaveBeenCalledWith('test@example.com', 'password123');
  });
  
  test('displays auth error when provided', () => {
    const errorMessage = 'Invalid credentials';
    render(<AuthForms {...defaultProps} authError={errorMessage} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
  
  test('disables form submission when isLoading is true', () => {
    render(<AuthForms {...defaultProps} isLoading={true} />);
    
    expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled();
  });
});
