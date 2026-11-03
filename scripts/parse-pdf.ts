/**
 * Dev utility: parse a Scotiabank credit card statement PDF and print the
 * result as JSON. Usage:
 *   npx tsx scripts/parse-pdf.ts path/to/statement.pdf
 *
 * Nothing is uploaded — parsing happens entirely on your machine.
 */
import { readFile } from 'node:fs/promises';
// Legacy build works in Node (no DOM/worker required).
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { itemsToLines, type PositionedItem } from '../src/lib/pdf/extract';
import { parseScotiaCreditStatement } from '../src/lib/pdf/scotiaCredit';

const path = process.argv[2];
if (!path) {
  console.error('usage: tsx scripts/parse-pdf.ts <statement.pdf>');
  process.exit(1);
}

const buf = await readFile(path);
const pdf = await getDocument({ data: new Uint8Array(buf) }).promise;

const lines: string[] = [];
for (let p = 1; p <= pdf.numPages; p++) {
  const page = await pdf.getPage(p);
  const tc = await page.getTextContent();
  const items: PositionedItem[] = [];
  for (const item of tc.items) {
    if ('str' in item && item.str.trim().length > 0) {
      items.push({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
      });
    }
  }
  lines.push(...itemsToLines(items));
}

const stmt = parseScotiaCreditStatement(lines);

const credits = stmt.transactions.filter((t) => t.amount < 0).reduce((s, t) => s + -t.amount, 0);
const debits = stmt.transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);

console.log(JSON.stringify({
  ...stmt,
  transactions: stmt.transactions,
  computed: { credits: Math.round(credits * 100) / 100, debits: Math.round(debits * 100) / 100, count: stmt.transactions.length },
}, null, 2));
