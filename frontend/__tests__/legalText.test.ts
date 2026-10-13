import { describe, it, expect } from '@jest/globals';
import { parseLegalText } from '@/utils/legalText';
import { DEFAULT_LEGAL } from '@/constants/defaultContent';

describe('parseLegalText', () => {
  it('splits headings, paragraphs and bullet lists', () => {
    const body = ['Intro line.', '', '## Rights', 'You may:', '• Access data', '- Delete data', '', 'Contact us.'].join('\n');
    expect(parseLegalText(body)).toEqual([
      { type: 'paragraph', text: 'Intro line.' },
      { type: 'heading', text: 'Rights' },
      { type: 'paragraph', text: 'You may:' },
      { type: 'bullets', items: ['Access data', 'Delete data'] },
      { type: 'paragraph', text: 'Contact us.' },
    ]);
  });

  it('keeps consecutive lines in one paragraph and handles Windows line endings', () => {
    expect(parseLegalText('Line one\r\nLine two')).toEqual([{ type: 'paragraph', text: 'Line one\nLine two' }]);
  });

  it('starts a new paragraph after a bullet list without a blank line', () => {
    expect(parseLegalText(['• One', 'After'].join('\n'))).toEqual([
      { type: 'bullets', items: ['One'] },
      { type: 'paragraph', text: 'After' },
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(parseLegalText('   \n\n')).toEqual([]);
  });

  it('parses the built-in privacy policy into four sections', () => {
    const headings = parseLegalText(DEFAULT_LEGAL.privacy).filter((b) => b.type === 'heading');
    expect(headings.map((h) => (h.type === 'heading' ? h.text : ''))).toEqual([
      'Data Collection',
      'Data Usage',
      'Data Security',
      'Your Rights',
    ]);
  });
});
