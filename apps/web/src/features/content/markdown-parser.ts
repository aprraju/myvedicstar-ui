/**
 * Minimal Markdown parser for the site's content pages (`src/content/pages/*.md`). Supports what those documents use:
 * `#`–`###` headings, paragraphs, `- ` bullet lists — the block structure only; inline emphasis is applied by the
 * renderer.
 *
 * Deliberately framework-free and dependency-free: it is used by the SPA (`markdown.tsx`) and by the deployment's
 * pre-renderer (`infrastructure/web/static-web-apps/scripts/prerender.ts`), which runs under `tsx` outside Vite.
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
