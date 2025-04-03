import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OutputDisplay from '../OutputDisplay';

describe('OutputDisplay Component', () => {
  test('renders loading state correctly', () => {
    render(
      <OutputDisplay
        processedData={[]}
        isLoading={true}
        error={null}
      />
    );
    
    expect(screen.getByText(/processing your text/i)).toBeInTheDocument();
  });
  
  test('renders error state correctly', () => {
    const errorMessage = 'An error occurred';
    render(
      <OutputDisplay
        processedData={[]}
        isLoading={false}
        error={errorMessage}
      />
    );
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
  
  test('renders empty state correctly', () => {
    render(
      <OutputDisplay
        processedData={[]}
        isLoading={false}
        error={null}
      />
    );
    
    expect(screen.getByText(/enter some japanese text/i)).toBeInTheDocument();
  });
  
  test('renders processed data correctly', () => {
    const mockData = [
      {
        original: 'こんにちは',
        furigana_html: '<ruby>今日<rt>きょう</rt></ruby>は',
        translation: 'Hello'
      },
      {
        original: 'お元気ですか',
        furigana_html: '<ruby>元気<rt>げんき</rt></ruby>ですか',
        translation: 'How are you?'
      }
    ];
    
    render(
      <OutputDisplay
        processedData={mockData}
        isLoading={false}
        error={null}
      />
    );
    
    // Check if the original text is displayed
    expect(screen.getByText('こんにちは')).toBeInTheDocument();
    expect(screen.getByText('お元気ですか')).toBeInTheDocument();
    
    // Check if translations are displayed
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('How are you?')).toBeInTheDocument();
    
    // Note: Testing the furigana HTML rendering is more complex due to dangerouslySetInnerHTML
    // We could use a more sophisticated approach if needed
  });
  
  test('handles data with errors correctly', () => {
    const mockData = [
      {
        original: 'こんにちは',
        furigana_html: 'こんにちは',
        translation: '[Translation Error]',
        error: 'API call failed'
      }
    ];
    
    render(
      <OutputDisplay
        processedData={mockData}
        isLoading={false}
        error={null}
      />
    );
    
    expect(screen.getByText('こんにちは')).toBeInTheDocument();
    expect(screen.getByText('[Translation Error]')).toBeInTheDocument();
    expect(screen.getByText('API call failed')).toBeInTheDocument();
  });
});
