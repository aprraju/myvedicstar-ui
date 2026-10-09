import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownDocument, parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('reads headings, paragraphs (joining wrapped lines) and bullet lists', () => {
    expect(parseMarkdown('# Title\n\nFirst line\ncontinues.\n\n## Section\n- one\n- two\n\nAfter.')).toEqual([
      { type: 'heading', level: 1, text: 'Title' },
      { type: 'paragraph', text: 'First line continues.' },
      { type: 'heading', level: 2, text: 'Section' },
      { type: 'list', items: ['one', 'two'] },
      { type: 'paragraph', text: 'After.' },
    ]);
  });

  it('handles Windows line endings and level-3 headings', () => {
    expect(parseMarkdown('### Account\r\nText')).toEqual([
      { type: 'heading', level: 3, text: 'Account' },
      { type: 'paragraph', text: 'Text' },
    ]);
  });
});

describe('MarkdownDocument', () => {
  it('renders bold/italic as elements and never interprets HTML', () => {
    const blocks = parseMarkdown('# Doc\n\nUse **Contact Us** or *email*. <script>alert(1)</script>');
    const { container } = render(
      <MarkdownDocument blocks={blocks} titleId="t" classNames={{ title: '', h2: '', h3: '', list: '' }} />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Doc' })).toHaveAttribute('id', 't');
    expect(container.querySelector('strong')).toHaveTextContent('Contact Us');
    expect(container.querySelector('em')).toHaveTextContent('email');
    expect(container.querySelector('script')).toBeNull();
    expect(container).toHaveTextContent('<script>alert(1)</script>');
  });
});
