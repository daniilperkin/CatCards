import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb } from 'pdf-lib';
import boldFontUrl from '../assets/fonts/NotoSans-Bold.ttf?url';
import regularFontUrl from '../assets/fonts/NotoSans-Regular.ttf?url';
import { type Card, type CatCardsDB, type Deck, db as defaultDb } from './db';

export type PdfLayout = 'sheet' | 'cards';

export interface PdfLabels {
  front: string;
  back: string;
  cards: string;
  fronts: string;
  backs: string;
}

export interface PreparedPdfImage {
  bytes: Uint8Array;
  format: 'jpg' | 'png';
}

export interface PdfExportOptions {
  layout: PdfLayout;
  labels: PdfLabels;
  date?: Date;
  db?: CatCardsDB;
  loadFonts?: () => Promise<{ regular: Uint8Array; bold: Uint8Array }>;
  prepareImage?: (blob: Blob) => Promise<PreparedPdfImage | null>;
}

// A4 dimensions in PDF points (72 pt = 1 inch)
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

const MAX_PDF_IMAGE_PX = 1200;
const SMALL_PNG_MAX_BYTES = 250_000;

const COLOR_TEXT = rgb(0.14, 0.08, 0.13);
const COLOR_MUTED = rgb(0.45, 0.39, 0.44);
const COLOR_BORDER = rgb(0.89, 0.82, 0.86);
const COLOR_CUT_LINE = rgb(0.74, 0.69, 0.73);
const COLOR_TINT = rgb(0.992, 0.949, 0.973);
const COLOR_ROW_ALT = rgb(0.996, 0.98, 0.988);
const COLOR_WHITE = rgb(1, 1, 1);

const CHAR_FALLBACKS: Record<string, string> = {
  '\t': '  ',
  '\u00A0': ' ',
  '\u200B': '',
  '\u200C': '',
  '\u200D': '',
  '\uFE0E': '',
  '\uFE0F': '',
  '\u00AD': '',
  '→': '->',
  '←': '<-',
  '↔': '<->',
  '⇒': '=>',
  '⇐': '<=',
  '⇔': '<=>',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
  '≈': '~',
  '∞': 'inf',
  '√': 'sqrt',
  '∑': 'sum',
  '∈': ' in ',
  '∉': ' not in ',
  '∅': '{}',
  '✓': '[x]',
  '✔': '[x]',
  '✗': '[ ]',
  '✘': '[ ]',
};

let cachedFonts: { regular: Uint8Array; bold: Uint8Array } | null = null;

async function fetchDefaultFonts(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  if (cachedFonts) return cachedFonts;
  const [regRes, boldRes] = await Promise.all([fetch(regularFontUrl), fetch(boldFontUrl)]);
  if (!regRes.ok || !boldRes.ok) throw new Error('Failed to load PDF fonts');
  const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);
  cachedFonts = { regular: new Uint8Array(regBuf), bold: new Uint8Array(boldBuf) };
  return cachedFonts;
}

/** Parses a #RRGGBB hex string into a pdf-lib rgb() color (falls back to CatCards pink). */
export function parseHexColor(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0xec / 255, 0x48 / 255, 0x99 / 255);
  const n = Number.parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * Sanitizes arbitrary user text so pdf-lib's embedded font can always encode it without throwing.
 * Maps common math/arrow symbols to readable ASCII fallbacks and strips unsupported glyphs (e.g. emojis).
 */
export function sanitizePdfText(text: string, supportedCodePoints: ReadonlySet<number>): string {
  const normalized = text.replace(/\r\n?/g, '\n');
  let out = '';
  for (const ch of normalized) {
    if (ch === '\n') {
      out += '\n';
      continue;
    }
    const cp = ch.codePointAt(0);
    if (cp === undefined || cp < 0x20) continue;
    if (supportedCodePoints.has(cp)) {
      out += ch;
      continue;
    }
    const fb = CHAR_FALLBACKS[ch];
    if (fb !== undefined) {
      for (const fch of fb) {
        const fcp = fch.codePointAt(0);
        if (fcp !== undefined && supportedCodePoints.has(fcp)) out += fch;
      }
    }
  }
  return out;
}

/** Wraps text into visual lines fitting within maxWidth, preserving explicit newlines and breaking overlong tokens. */
export function wrapText(text: string, maxWidth: number, measure: (segment: string) => number): string[] {
  if (!text) return [];
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/).filter(Boolean);
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) {
        lines.push(current);
        current = '';
      }
      if (measure(word) <= maxWidth) {
        current = word;
      } else {
        // Hard-break an extra-long unbreakable token (URL, compound word) by code point.
        let chunk = '';
        for (const ch of word) {
          if (chunk && measure(chunk + ch) > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        current = chunk;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function truncateLines(
  lines: string[],
  maxLines: number,
  maxWidth: number,
  measure: (s: string) => number,
  ellipsis: string,
): string[] {
  if (lines.length <= maxLines) return lines;
  if (maxLines <= 0) return [];
  const sliced = lines.slice(0, maxLines);
  let last = sliced[maxLines - 1].trimEnd();
  while (last.length > 0 && measure(last + ellipsis) > maxWidth) {
    last = [...last].slice(0, -1).join('').trimEnd();
  }
  sliced[maxLines - 1] = last ? last + ellipsis : ellipsis;
  return sliced;
}

/**
 * Returns the (row, col) grid cell for a card on a 2×4 printable flashcard sheet.
 * Back pages mirror columns horizontally so long-edge duplex printing aligns fronts & backs.
 */
export function cardGridSlot(indexInSheet: number, side: 'front' | 'back'): { row: number; col: number } {
  const row = Math.floor(indexInSheet / 2);
  const frontCol = indexInSheet % 2;
  return { row, col: side === 'front' ? frontCol : 1 - frontCol };
}

/** Downscales & transcodes a stored photo solely for compact PDF embedding (IndexedDB blob stays untouched). */
async function prepareBrowserImageForPdf(blob: Blob): Promise<PreparedPdfImage | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const url = URL.createObjectURL(blob);
    const el = new Image();
    el.onload = () => {
      URL.revokeObjectURL(url);
      resolve(el);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    el.src = url;
  });

  if (!img || img.naturalWidth <= 0 || img.naturalHeight <= 0) return null;

  const natW = img.naturalWidth;
  const natH = img.naturalHeight;

  // Keep small, crisp PNGs (screenshots/diagrams) lossless; transcode everything else to bounded JPEG.
  if (
    blob.type === 'image/png' &&
    natW <= MAX_PDF_IMAGE_PX &&
    natH <= MAX_PDF_IMAGE_PX &&
    blob.size <= SMALL_PNG_MAX_BYTES
  ) {
    return { bytes: new Uint8Array(await blob.arrayBuffer()), format: 'png' };
  }

  const scale = Math.min(1, MAX_PDF_IMAGE_PX / Math.max(natW, natH));
  const width = Math.max(1, Math.round(natW * scale));
  const height = Math.max(1, Math.round(natH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const jpgBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!jpgBlob) return null;
  return { bytes: new Uint8Array(await jpgBlob.arrayBuffer()), format: 'jpg' };
}

function fitImageDimensions(img: PDFImage, maxW: number, maxH: number): { width: number; height: number } {
  if (img.width <= 0 || img.height <= 0 || maxW <= 0 || maxH <= 0) return { width: 0, height: 0 };
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  return { width: img.width * scale, height: img.height * scale };
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

interface EmbeddedCard {
  index: number;
  frontText: string;
  backText: string;
  frontImg: PDFImage | null;
  backImg: PDFImage | null;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  supported: Set<number>;
  ellipsis: string;
}

function drawStudySheet(
  doc: PDFDocument,
  deck: Deck,
  cards: EmbeddedCard[],
  fonts: Fonts,
  labels: PdfLabels,
  date: Date,
) {
  const marginX = 34;
  const marginTop = 34;
  const marginBottom = 38;
  const contentW = A4_WIDTH - marginX * 2;
  const numW = 26;
  const colW = (contentW - numW) / 2;
  const padX = 10;
  const padY = 9;
  const innerW = colW - padX * 2;
  const cardGap = 7;
  const colHeaderH = 22;
  const deckColor = parseHexColor(deck.color);
  const safeDeckName = sanitizePdfText(deck.name, fonts.supported) || 'CatCards';
  const safeFrontLabel = sanitizePdfText(labels.front, fonts.supported);
  const safeBackLabel = sanitizePdfText(labels.back, fonts.supported);
  const safeCardsLabel = sanitizePdfText(labels.cards, fonts.supported);

  const drawColumnHeaders = (page: PDFPage, topY: number): number => {
    const y = topY - colHeaderH;
    page.drawRectangle({
      x: marginX,
      y,
      width: contentW,
      height: colHeaderH,
      color: COLOR_TINT,
      borderColor: COLOR_BORDER,
      borderWidth: 0.75,
    });
    const labelSize = 9;
    const textY = y + (colHeaderH - fonts.bold.heightAtSize(labelSize, { descender: false })) / 2;
    page.drawText('#', {
      x: marginX + (numW - fonts.bold.widthOfTextAtSize('#', labelSize)) / 2,
      y: textY,
      size: labelSize,
      font: fonts.bold,
      color: COLOR_MUTED,
    });
    page.drawText(safeFrontLabel, {
      x: marginX + numW + padX,
      y: textY,
      size: labelSize,
      font: fonts.bold,
      color: COLOR_TEXT,
    });
    page.drawText(safeBackLabel, {
      x: marginX + numW + colW + padX,
      y: textY,
      size: labelSize,
      font: fonts.bold,
      color: COLOR_TEXT,
    });
    return y - 6;
  };

  const addSheetPage = (isFirst: boolean): { page: PDFPage; cursorY: number } => {
    const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
    let topY = A4_HEIGHT - marginTop;

    if (isFirst) {
      const bannerH = 44;
      const bannerY = topY - bannerH;
      // Deck accent bar + title + metadata
      page.drawRectangle({ x: marginX, y: bannerY + 4, width: 4, height: bannerH - 8, color: deckColor });
      const titleSize = 17;
      const titleMaxW = contentW - 14;
      const titleLine = truncateLines(
        wrapText(safeDeckName, titleMaxW, (s) => fonts.bold.widthOfTextAtSize(s, titleSize)),
        1,
        titleMaxW,
        (s) => fonts.bold.widthOfTextAtSize(s, titleSize),
        fonts.ellipsis,
      )[0];
      page.drawText(titleLine ?? safeDeckName, {
        x: marginX + 12,
        y: topY - 19,
        size: titleSize,
        font: fonts.bold,
        color: COLOR_TEXT,
      });
      const meta = sanitizePdfText(`${cards.length} ${safeCardsLabel}  •  ${formatDate(date)}`, fonts.supported);
      page.drawText(meta, {
        x: marginX + 12,
        y: bannerY + 7,
        size: 9.5,
        font: fonts.regular,
        color: COLOR_MUTED,
      });
      topY = bannerY - 8;
    } else {
      page.drawCircle({ x: marginX + 4, y: topY - 6, size: 3.5, color: deckColor });
      const runningTitle = truncateLines(
        wrapText(safeDeckName, contentW - 20, (s) => fonts.bold.widthOfTextAtSize(s, 9.5)),
        1,
        contentW - 20,
        (s) => fonts.bold.widthOfTextAtSize(s, 9.5),
        fonts.ellipsis,
      )[0];
      page.drawText(runningTitle ?? safeDeckName, {
        x: marginX + 13,
        y: topY - 9,
        size: 9.5,
        font: fonts.bold,
        color: COLOR_MUTED,
      });
      topY -= 18;
    }

    const cursorY = drawColumnHeaders(page, topY);
    return { page, cursorY };
  };

  interface MeasuredSide {
    font: PDFFont;
    fontSize: number;
    lineHeight: number;
    lines: string[];
    img: PDFImage | null;
    imgW: number;
    imgH: number;
    totalH: number;
  }

  const measureSide = (
    text: string,
    img: PDFImage | null,
    preferBold: boolean,
    fontSize: number,
    maxImgH: number,
    maxContentH: number,
  ): MeasuredSide => {
    const rawLineCount = text ? text.split('\n').length : 0;
    const font = preferBold && rawLineCount <= 3 && text.length <= 120 ? fonts.bold : fonts.regular;
    const lineHeight = fontSize * 1.38;
    const imgDim = img ? fitImageDimensions(img, innerW, maxImgH) : { width: 0, height: 0 };
    const imgGap = img && text ? 7 : 0;

    let lines = wrapText(text, innerW, (s) => font.widthOfTextAtSize(s, fontSize));
    const availForText = Math.max(lineHeight, maxContentH - imgDim.height - imgGap);
    const maxLines = Math.max(1, Math.floor(availForText / lineHeight));
    if (lines.length > maxLines) {
      lines = truncateLines(lines, maxLines, innerW, (s) => font.widthOfTextAtSize(s, fontSize), fonts.ellipsis);
    }

    const textH = lines.length * lineHeight;
    const totalH = padY * 2 + imgDim.height + imgGap + textH;
    return { font, fontSize, lineHeight, lines, img, imgW: imgDim.width, imgH: imgDim.height, totalH };
  };

  const drawSide = (page: PDFPage, side: MeasuredSide, colX: number, rowTopY: number) => {
    let y = rowTopY - padY;
    if (side.img && side.imgW > 0 && side.imgH > 0) {
      const imgX = colX + padX + (innerW - side.imgW) / 2;
      const imgY = y - side.imgH;
      page.drawImage(side.img, { x: imgX, y: imgY, width: side.imgW, height: side.imgH });
      y = imgY - (side.lines.length > 0 ? 7 : 0);
    }
    if (side.lines.length > 0) {
      const ascent = side.font.heightAtSize(side.fontSize, { descender: false });
      for (const line of side.lines) {
        if (line) {
          page.drawText(line, {
            x: colX + padX,
            y: y - ascent,
            size: side.fontSize,
            font: side.font,
            color: COLOR_TEXT,
          });
        }
        y -= side.lineHeight;
      }
    }
  };

  let { page, cursorY } = addSheetPage(true);
  const bodyBottomY = marginBottom + 14;
  const maxPageBodyH = A4_HEIGHT - marginTop - 18 - colHeaderH - 6 - bodyBottomY;

  for (const card of cards) {
    // Try comfortable default sizing first; shrink slightly only for unusually long cards.
    let frontM = measureSide(card.frontText, card.frontImg, true, 10, 150, maxPageBodyH - padY * 2);
    let backM = measureSide(card.backText, card.backImg, false, 10, 150, maxPageBodyH - padY * 2);
    let rowH = Math.max(42, frontM.totalH, backM.totalH);

    if (rowH > maxPageBodyH * 0.85) {
      frontM = measureSide(card.frontText, card.frontImg, false, 8.8, 115, maxPageBodyH - padY * 2);
      backM = measureSide(card.backText, card.backImg, false, 8.8, 115, maxPageBodyH - padY * 2);
      rowH = Math.min(maxPageBodyH, Math.max(42, frontM.totalH, backM.totalH));
    }

    if (cursorY - rowH < bodyBottomY && cursorY < A4_HEIGHT - marginTop - 90) {
      ({ page, cursorY } = addSheetPage(false));
    }

    const rowBottomY = cursorY - rowH;
    const rowBg = card.index % 2 === 0 ? COLOR_WHITE : COLOR_ROW_ALT;

    // Card row container
    page.drawRectangle({
      x: marginX,
      y: rowBottomY,
      width: contentW,
      height: rowH,
      color: rowBg,
      borderColor: COLOR_BORDER,
      borderWidth: 0.7,
    });
    // Left index strip
    page.drawRectangle({
      x: marginX + 0.5,
      y: rowBottomY + 0.5,
      width: numW - 0.5,
      height: rowH - 1,
      color: COLOR_TINT,
    });
    // Vertical dividers
    page.drawLine({
      start: { x: marginX + numW, y: rowBottomY },
      end: { x: marginX + numW, y: cursorY },
      thickness: 0.6,
      color: COLOR_BORDER,
    });
    page.drawLine({
      start: { x: marginX + numW + colW, y: rowBottomY },
      end: { x: marginX + numW + colW, y: cursorY },
      thickness: 0.6,
      color: COLOR_BORDER,
    });

    // Card number (top-aligned cleanly with content)
    const numStr = String(card.index + 1);
    const numSize = 8.5;
    const numAscent = fonts.bold.heightAtSize(numSize, { descender: false });
    page.drawText(numStr, {
      x: marginX + (numW - fonts.bold.widthOfTextAtSize(numStr, numSize)) / 2,
      y: cursorY - padY - numAscent,
      size: numSize,
      font: fonts.bold,
      color: COLOR_MUTED,
    });

    drawSide(page, frontM, marginX + numW, cursorY);
    drawSide(page, backM, marginX + numW + colW, cursorY);

    cursorY = rowBottomY - cardGap;
  }

  // Page footers
  const pages = doc.getPages();
  const total = pages.length;
  pages.forEach((p, idx) => {
    const footY = marginBottom - 16;
    p.drawLine({
      start: { x: marginX, y: footY + 12 },
      end: { x: A4_WIDTH - marginX, y: footY + 12 },
      thickness: 0.5,
      color: COLOR_BORDER,
    });
    p.drawText('CatCards', { x: marginX, y: footY, size: 8, font: fonts.regular, color: COLOR_MUTED });
    const pageNum = `${idx + 1} / ${total}`;
    p.drawText(pageNum, {
      x: A4_WIDTH - marginX - fonts.regular.widthOfTextAtSize(pageNum, 8),
      y: footY,
      size: 8,
      font: fonts.regular,
      color: COLOR_MUTED,
    });
  });
}

function drawPrintableCards(doc: PDFDocument, deck: Deck, cards: EmbeddedCard[], fonts: Fonts, labels: PdfLabels) {
  const marginX = 24;
  const marginY = 28;
  const cols = 2;
  const rows = 4;
  const perSheet = cols * rows;
  const cellW = (A4_WIDTH - marginX * 2) / cols;
  const cellH = (A4_HEIGHT - marginY * 2) / rows;
  const pad = 12;
  const footerBandH = 13;
  const innerW = cellW - pad * 2;
  const innerH = cellH - pad * 2 - footerBandH;
  const deckColor = parseHexColor(deck.color);
  const safeDeckName = sanitizePdfText(deck.name, fonts.supported) || 'CatCards';
  const safeFronts = sanitizePdfText(labels.fronts, fonts.supported);
  const safeBacks = sanitizePdfText(labels.backs, fonts.supported);

  const drawCellContent = (
    page: PDFPage,
    cellX: number,
    cellY: number,
    text: string,
    img: PDFImage | null,
    isFront: boolean,
    cardNumber: number,
  ) => {
    // Dashed cut outline
    page.drawRectangle({
      x: cellX,
      y: cellY,
      width: cellW,
      height: cellH,
      color: COLOR_WHITE,
      borderColor: COLOR_CUT_LINE,
      borderWidth: 0.65,
      borderDashArray: [4, 4],
    });

    // Subtle top accent stripe on front cards to distinguish front vs back at a glance
    if (isFront) {
      page.drawRectangle({
        x: cellX + 1,
        y: cellY + cellH - 3.5,
        width: cellW - 2,
        height: 2.5,
        color: deckColor,
      });
    }

    const contentBottomY = cellY + pad + footerBandH;
    const contentLeftX = cellX + pad;

    if (img && !text) {
      const dim = fitImageDimensions(img, innerW, innerH);
      page.drawImage(img, {
        x: contentLeftX + (innerW - dim.width) / 2,
        y: contentBottomY + (innerH - dim.height) / 2,
        width: dim.width,
        height: dim.height,
      });
    } else if (img && text) {
      const maxImgH = innerH * 0.62;
      const imgDim = fitImageDimensions(img, innerW, maxImgH);
      const gap = 6;
      const availTextH = Math.max(12, innerH - imgDim.height - gap);

      const font = isFront ? fonts.bold : fonts.regular;
      const sizes = [11, 9.8, 8.8, 7.8];
      let chosenSize = sizes[sizes.length - 1];
      let lines: string[] = [];

      for (const s of sizes) {
        const lh = s * 1.32;
        const wrapped = wrapText(text, innerW, (seg) => font.widthOfTextAtSize(seg, s));
        if (wrapped.length * lh <= availTextH) {
          chosenSize = s;
          lines = wrapped;
          break;
        }
        lines = wrapped;
      }

      const lh = chosenSize * 1.32;
      const maxLines = Math.max(1, Math.floor(availTextH / lh));
      lines = truncateLines(lines, maxLines, innerW, (seg) => font.widthOfTextAtSize(seg, chosenSize), fonts.ellipsis);

      const totalBlockH = imgDim.height + gap + lines.length * lh;
      const blockTopY = contentBottomY + (innerH + totalBlockH) / 2;

      page.drawImage(img, {
        x: contentLeftX + (innerW - imgDim.width) / 2,
        y: blockTopY - imgDim.height,
        width: imgDim.width,
        height: imgDim.height,
      });

      const ascent = font.heightAtSize(chosenSize, { descender: false });
      const centerAlign = lines.length <= 2 && !text.includes('\n');
      let textY = blockTopY - imgDim.height - gap;
      for (const line of lines) {
        if (line) {
          const lw = font.widthOfTextAtSize(line, chosenSize);
          page.drawText(line, {
            x: centerAlign ? contentLeftX + (innerW - lw) / 2 : contentLeftX,
            y: textY - ascent,
            size: chosenSize,
            font,
            color: COLOR_TEXT,
          });
        }
        textY -= lh;
      }
    } else if (text) {
      const hasMultiLine = text.includes('\n');
      const font = isFront && text.length <= 120 && !hasMultiLine ? fonts.bold : fonts.regular;
      const sizes = isFront ? [14, 12.5, 11, 9.6, 8.5, 7.6] : [12.5, 11, 9.8, 8.8, 7.8];
      let chosenSize = sizes[sizes.length - 1];
      let lines: string[] = [];

      for (const s of sizes) {
        const lh = s * 1.36;
        const wrapped = wrapText(text, innerW, (seg) => font.widthOfTextAtSize(seg, s));
        if (wrapped.length * lh <= innerH) {
          chosenSize = s;
          lines = wrapped;
          break;
        }
        lines = wrapped;
      }

      const lh = chosenSize * 1.36;
      const maxLines = Math.max(1, Math.floor(innerH / lh));
      lines = truncateLines(lines, maxLines, innerW, (seg) => font.widthOfTextAtSize(seg, chosenSize), fonts.ellipsis);

      const ascent = font.heightAtSize(chosenSize, { descender: false });
      const visualH = (lines.length - 1) * lh + ascent;
      const centerAlign = lines.length <= 4 && !hasMultiLine;
      let baselineY = contentBottomY + (innerH + visualH) / 2 - ascent;

      for (const line of lines) {
        if (line) {
          const lw = font.widthOfTextAtSize(line, chosenSize);
          page.drawText(line, {
            x: centerAlign ? contentLeftX + (innerW - lw) / 2 : contentLeftX,
            y: baselineY,
            size: chosenSize,
            font,
            color: COLOR_TEXT,
          });
        }
        baselineY -= lh;
      }
    }

    // Subtle card footer (#index + deck name)
    const microSize = 7.2;
    const microY = cellY + 7;
    const sideTag = isFront ? labels.front : labels.back;
    const microLabel = sanitizePdfText(`#${cardNumber}  •  ${sideTag}`, fonts.supported);
    page.drawText(microLabel, {
      x: cellX + pad,
      y: microY,
      size: microSize,
      font: fonts.regular,
      color: COLOR_MUTED,
    });
    const deckMicro = truncateLines(
      wrapText(safeDeckName, cellW * 0.45, (s) => fonts.regular.widthOfTextAtSize(s, microSize)),
      1,
      cellW * 0.45,
      (s) => fonts.regular.widthOfTextAtSize(s, microSize),
      fonts.ellipsis,
    )[0];
    if (deckMicro) {
      page.drawText(deckMicro, {
        x: cellX + cellW - pad - fonts.regular.widthOfTextAtSize(deckMicro, microSize),
        y: microY,
        size: microSize,
        font: fonts.regular,
        color: COLOR_MUTED,
      });
    }
  };

  const totalSheets = Math.ceil(cards.length / perSheet);
  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const batch = cards.slice(sheet * perSheet, (sheet + 1) * perSheet);
    const frontPage = doc.addPage([A4_WIDTH, A4_HEIGHT]);
    const backPage = doc.addPage([A4_WIDTH, A4_HEIGHT]);

    batch.forEach((card, i) => {
      const fSlot = cardGridSlot(i, 'front');
      const fX = marginX + fSlot.col * cellW;
      const fY = A4_HEIGHT - marginY - (fSlot.row + 1) * cellH;
      drawCellContent(frontPage, fX, fY, card.frontText, card.frontImg, true, card.index + 1);

      const bSlot = cardGridSlot(i, 'back');
      const bX = marginX + bSlot.col * cellW;
      const bY = A4_HEIGHT - marginY - (bSlot.row + 1) * cellH;
      drawCellContent(backPage, bX, bY, card.backText, card.backImg, false, card.index + 1);
    });

    // Subtle margin caption below the symmetric grid (keeps front & back grid perfectly aligned)
    const drawSheetFooter = (page: PDFPage, kind: string, pageNum: number) => {
      const left = sanitizePdfText(`${safeDeckName}  •  ${kind}`, fonts.supported);
      const right = `${pageNum} / ${totalSheets * 2}`;
      const y = 10;
      page.drawText(left, { x: marginX, y, size: 7.5, font: fonts.regular, color: COLOR_MUTED });
      page.drawText(right, {
        x: A4_WIDTH - marginX - fonts.regular.widthOfTextAtSize(right, 7.5),
        y,
        size: 7.5,
        font: fonts.regular,
        color: COLOR_MUTED,
      });
    };
    drawSheetFooter(frontPage, safeFronts, sheet * 2 + 1);
    drawSheetFooter(backPage, safeBacks, sheet * 2 + 2);
  }
}

/** Generates a real vector-text PDF Blob for a deck (selectable Latin/Cyrillic text + fitted photos). */
export async function exportDeckPdf(deckId: string, options: PdfExportOptions): Promise<Blob> {
  const db = options.db ?? defaultDb;
  const [deck, rawCards] = await Promise.all([
    db.decks.get(deckId),
    db.cards.where('deckId').equals(deckId).sortBy('createdAt'),
  ]);
  if (!deck) throw new Error('Deck not found');
  if (rawCards.length === 0) throw new Error('Deck has no cards');

  const fontData = await (options.loadFonts ?? fetchDefaultFonts)();
  const prepareImage = options.prepareImage ?? prepareBrowserImageForPdf;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(deck.name);
  doc.setCreator('CatCards');
  doc.setProducer('CatCards');

  const regular = await doc.embedFont(fontData.regular, { subset: true });
  const bold = await doc.embedFont(fontData.bold, { subset: true });
  const supported = new Set<number>(regular.getCharacterSet());
  const ellipsis = supported.has(0x2026) ? '…' : '...';
  const fonts: Fonts = { regular, bold, supported, ellipsis };

  // Embed unique referenced images sequentially to keep peak mobile RAM low.
  const embeddedImages = new Map<string, PDFImage | null>();
  const loadEmbeddedImage = async (imageId: string | null): Promise<PDFImage | null> => {
    if (!imageId) return null;
    if (embeddedImages.has(imageId)) return embeddedImages.get(imageId) ?? null;
    const row = await db.images.get(imageId);
    if (!row?.blob) {
      embeddedImages.set(imageId, null);
      return null;
    }
    try {
      const prepared = await prepareImage(row.blob);
      if (!prepared) {
        embeddedImages.set(imageId, null);
        return null;
      }
      const img = prepared.format === 'png' ? await doc.embedPng(prepared.bytes) : await doc.embedJpg(prepared.bytes);
      embeddedImages.set(imageId, img);
      return img;
    } catch {
      embeddedImages.set(imageId, null);
      return null;
    }
  };

  const embeddedCards: EmbeddedCard[] = [];
  for (let i = 0; i < rawCards.length; i++) {
    const c: Card = rawCards[i];
    embeddedCards.push({
      index: i,
      frontText: sanitizePdfText(c.frontText.trim(), supported),
      backText: sanitizePdfText(c.backText.trim(), supported),
      frontImg: await loadEmbeddedImage(c.frontImageId),
      backImg: await loadEmbeddedImage(c.backImageId),
    });
  }

  const date = options.date ?? new Date();
  if (options.layout === 'cards') {
    drawPrintableCards(doc, deck, embeddedCards, fonts, options.labels);
  } else {
    drawStudySheet(doc, deck, embeddedCards, fonts, options.labels, date);
  }

  const pdfBytes = await doc.save();
  return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
}

export function buildPdfFilename(deckName: string, layout: PdfLayout, date = new Date()): string {
  const iso = date.toISOString().slice(0, 10);
  const safePrefix =
    deckName
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'catcards';
  return `${safePrefix}${layout === 'cards' ? '-cards' : ''}-${iso}.pdf`;
}

export async function shareOrDownloadDeckPdf(
  deckId: string,
  deckName: string,
  layout: PdfLayout,
  labels: PdfLabels,
  db: CatCardsDB = defaultDb,
): Promise<void> {
  const blob = await exportDeckPdf(deckId, { layout, labels, db });
  const name = buildPdfFilename(deckName, layout);
  const file = new File([blob], name, { type: 'application/pdf' });

  // Prefer Android share sheet (Telegram, Drive, Files, Print); fall back to direct download.
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
