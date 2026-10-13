/**
 * Turns admin-written legal text into blocks the app can style:
 * "## " lines are headings, lines starting with "• " or "- " are bullets,
 * and blank lines separate paragraphs.
 */

export type LegalBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] };

const BULLET = /^\s*(?:•|-)\s+/;

export function parseLegalText(body: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
    if (bullets.length > 0) blocks.push({ type: 'bullets', items: bullets });
    paragraph = [];
    bullets = [];
  };

  for (const rawLine of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flush();
    } else if (line.startsWith('## ')) {
      flush();
      blocks.push({ type: 'heading', text: line.slice(3).trim() });
    } else if (BULLET.test(line)) {
      if (paragraph.length > 0) {
        blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
        paragraph = [];
      }
      bullets.push(line.replace(BULLET, ''));
    } else {
      if (bullets.length > 0) {
        blocks.push({ type: 'bullets', items: bullets });
        bullets = [];
      }
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}
