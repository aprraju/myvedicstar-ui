import { Fragment, type ReactNode } from 'react';

/**
 * Minimal Markdown renderer for the site's content pages (`src/content/pages/*.md`). Supports what those documents use:
 * `#`–`###` headings, paragraphs, `-` bullet lists, `**bold**` and `*italic*`. Everything is rendered as React text
 * nodes — never as HTML — so it is safe and Content-Security-Policy friendly.
 */
export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    if (list) blocks.push({ type: 'list', items: list });
    paragraph = [];
    list = null;
  };

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      const [, hashes = '#', text = ''] = heading;
      blocks.push({ type: 'heading', level: hashes.length as 1 | 2 | 3, text });
    } else if (bullet) {
      if (paragraph.length) flush();
      (list ??= []).push(bullet[1] ?? '');
    } else {
      if (list) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/** `**bold**` and `*italic*` → <strong>/<em>; everything else stays plain text. */
export function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Renders parsed blocks. The document's `#` heading becomes the page's <h1> (given `titleId` for labelling). */
export function MarkdownDocument({
  blocks,
  titleId,
  classNames,
}: Readonly<{
  blocks: readonly MarkdownBlock[];
  titleId: string;
  classNames: { title: string; h2: string; h3: string; list: string };
}>) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            if (block.level === 1) {
              return (
                <h1 key={i} id={titleId} className={classNames.title}>
                  {block.text}
                </h1>
              );
            }
            return block.level === 2 ? (
              <h2 key={i} className={classNames.h2}>
                {renderInline(block.text)}
              </h2>
            ) : (
              <h3 key={i} className={classNames.h3}>
                {renderInline(block.text)}
              </h3>
            );
          case 'list':
            return (
              <ul key={i} className={classNames.list}>
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          default:
            return <p key={i}>{renderInline(block.text)}</p>;
        }
      })}
    </>
  );
}
