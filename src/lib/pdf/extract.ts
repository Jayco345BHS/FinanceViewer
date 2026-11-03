/**
 * PDF text extraction using pdf.js. Produces plain text lines (top-to-bottom)
 * that feed into the statement parsers. Runs fully client-side.
 */
import { getDocument } from 'pdfjs-dist';

export interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Group positioned text items into visual lines. */
export function itemsToLines(items: PositionedItem[]): string[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; items: PositionedItem[] }[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= Math.max(2.5, it.height * 0.4)) {
      last.items.push(it);
    } else {
      lines.push({ y: it.y, items: [it] });
    }
  }
  return lines.map((l) => joinItems(l.items.sort((a, b) => a.x - b.x)));
}

function joinItems(items: PositionedItem[]): string {
  let out = '';
  let prevEnd: number | null = null;
  let prevHeight = 0;
  for (const it of items) {
    if (prevEnd !== null) {
      const gap = it.x - prevEnd;
      // Insert a space for visual gaps so columns don't fuse together.
      if (gap > Math.max(1.5, prevHeight * 0.15) && !out.endsWith(' ') && !it.str.startsWith(' ')) {
        out += ' ';
      }
    }
    out += it.str;
    prevEnd = it.x + it.width;
    prevHeight = it.height;
  }
  return out.trim();
}

export async function extractLinesFromPdf(data: ArrayBuffer): Promise<string[]> {
  const pdf = await getDocument({ data }).promise;
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
  return lines;
}
