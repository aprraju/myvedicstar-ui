import { Fragment, type ReactNode } from 'react';

import { type MarkdownBlock, parseMarkdown } from './markdown-parser';

/**
 * Renders the site content pages' Markdown as React nodes. The block parser lives in `markdown-parser.ts` so the
 * deployment's pre-renderer can use it too; that module is framework-free.
 *
 * Everything is rendered as React text nodes — never as HTML — so it is safe and Content-Security-Policy friendly.
 */
export { parseMarkdown };

/** `**bold**` and `*italic*` → <strong>/<em>; everything else stays plain text. */
function renderInline(text: string): ReactNode {
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
