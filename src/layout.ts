/** Numeric rules for measured panels. Freerange checks this file at build time.
 * Imported text measurements and browser sizes are validated at the boundary.
 */
export function panelWidth(observedWidth: number): number {
  const width = Math.max(1, Math.floor(observedWidth));
  console.assert(width >= 1);
  return width;
}

export function codeViewport(panel: number): number {
  console.assert(panel >= 1);
  const available = Math.max(1, panel - 40);
  console.assert(available >= 1);
  console.assert(available <= panel);
  return available;
}

export function textHeight(lineCount: number, lineHeight: number): number {
  console.assert(Number.isInteger(lineCount));
  console.assert(lineCount >= 0);
  console.assert(lineCount <= 1_000_000);
  console.assert(lineHeight > 0);
  console.assert(lineHeight <= 128);
  const height = lineCount * lineHeight;
  console.assert(height >= 0);
  return height;
}

export function needsScroll(naturalWidth: number, available: number): boolean {
  console.assert(naturalWidth >= 0);
  console.assert(available >= 1);
  return naturalWidth > available;
}
