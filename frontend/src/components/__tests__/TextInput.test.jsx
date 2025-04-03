import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TextInput from '../TextInput';

describe('TextInput Component', () => {
  test('renders correctly', () => {
    const mockSetInputText = vi.fn();
    const mockHandleProcessText = vi.fn();
    
    render(
      <TextInput
        inputText=""
        setInputText={mockSetInputText}
        handleProcessText={mockHandleProcessText}
        isLoading={false}
      />
    );
    
    // Check if the textarea is rendered
    expect(screen.getByPlaceholderText(/Enter Japanese text/i)).toBeInTheDocument();
    
    // Check if the process button is rendered
    expect(screen.getByRole('button', { name: /process/i })).toBeInTheDocument();
  });
  
  test('updates input text when typing', () => {
    const mockSetInputText = vi.fn();
    const mockHandleProcessText = vi.fn();
    
    render(
      <TextInput
        inputText=""
        setInputText={mockSetInputText}
        handleProcessText={mockHandleProcessText}
        isLoading={false}
      />
    );
    
    const textarea = screen.getByPlaceholderText(/Enter Japanese text/i);
    fireEvent.change(textarea, { target: { value: 'こんにちは' } });
    
    expect(mockSetInputText).toHaveBeenCalledWith('こんにちは');
  });
  
  test('calls handleProcessText when process button is clicked', () => {
    const mockSetInputText = vi.fn();
    const mockHandleProcessText = vi.fn();
    
    render(
      <TextInput
        inputText="こんにちは"
        setInputText={mockSetInputText}
        handleProcessText={mockHandleProcessText}
        isLoading={false}
      />
    );
    
    const processButton = screen.getByRole('button', { name: /process/i });
    fireEvent.click(processButton);
    
    expect(mockHandleProcessText).toHaveBeenCalled();
  });
  
  test('disables process button when isLoading is true', () => {
    const mockSetInputText = vi.fn();
    const mockHandleProcessText = vi.fn();
    
    render(
      <TextInput
        inputText="こんにちは"
        setInputText={mockSetInputText}
        handleProcessText={mockHandleProcessText}
        isLoading={true}
      />
    );
    
    const processButton = screen.getByRole('button', { name: /processing/i });
    expect(processButton).toBeDisabled();
  });
  
  test('shows sample text buttons', () => {
    const mockSetInputText = vi.fn();
    const mockHandleProcessText = vi.fn();
    
    render(
      <TextInput
        inputText=""
        setInputText={mockSetInputText}
        handleProcessText={mockHandleProcessText}
        isLoading={false}
      />
    );
    
    // Check if sample text buttons are rendered
    const sampleButtons = screen.getAllByRole('button', { name: /sample/i });
    expect(sampleButtons.length).toBeGreaterThan(0);
    
    // Click a sample button and check if setInputText is called
    fireEvent.click(sampleButtons[0]);
    expect(mockSetInputText).toHaveBeenCalled();
  });
});
