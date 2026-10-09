import "@fontsource/ibm-plex-mono/latin-400.css";
import "./style.css";
import {
  prepare,
  prepareWithSegments,
  layout,
  measureNaturalWidth,
} from "@chenglou/pretext";
import { panelWidth, codeViewport, needsScroll, textHeight } from "./layout";

const announcer = document.getElementById("copy-status");
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-copy]",
)) {
  button.addEventListener("click", async () => {
    const code = document.getElementById(button.dataset.copy ?? "");
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.textContent ?? "");
      button.textContent = "copied";
      if (announcer) announcer.textContent = "Code copied to clipboard.";
      setTimeout(() => {
        button.textContent = "copy";
      }, 1600);
    } catch {
      button.textContent = "select code";
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection?.removeAllRanges();
      selection?.addRange(range);
      if (announcer)
        announcer.textContent =
          "Select the code and copy it with your keyboard.";
    }
  });
}

// Prepare once after the font loads; resize only does cached arithmetic.
// CSS owns wrapping and DOM text remains selectable/searchable/accessible.
async function measuredPanels() {
  await document.fonts.load('12px "IBM Plex Mono"');
  await document.fonts.ready;
  const elements = new Map<
    Element,
    { naturalWidth: number; code: HTMLElement }
  >();
  for (const panel of document.querySelectorAll<HTMLElement>(".code-panel")) {
    const code = panel.querySelector("code");
    if (!code) continue;
    const prepared = prepareWithSegments(
      code.textContent ?? "",
      '12px "IBM Plex Mono"',
      { whiteSpace: "pre-wrap" },
    );
    const naturalWidth = measureNaturalWidth(prepared);
    // Mobile CSS paints at 11px, so reprepare once per font, not per resize.
    const compact = prepareWithSegments(
      code.textContent ?? "",
      '11px "IBM Plex Mono"',
      { whiteSpace: "pre-wrap" },
    );
    panel.dataset.naturalWidth = String(naturalWidth);
    panel.dataset.compactWidth = String(measureNaturalWidth(compact));
    elements.set(panel, {
      naturalWidth,
      code,
    });
  }
  const lede = document.querySelector<HTMLElement>("[data-measure]");
  const preparedLede = lede
    ? prepare(lede.textContent ?? "", "18px Arial")
    : null;
  const resize = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const observedWidth = entry.contentRect.width;
      if (!Number.isFinite(observedWidth) || observedWidth <= 0) continue;
      const width = panelWidth(observedWidth);
      if (entry.target === lede && lede && preparedLede) {
        const result = layout(preparedLede, width, 28);
        if (
          !Number.isInteger(result.lineCount) ||
          result.lineCount < 0 ||
          result.lineCount > 1_000_000
        )
          continue;
        lede.style.minHeight = `${textHeight(result.lineCount, 28)}px`;
        lede.dataset.measuredLines = String(result.lineCount);
      } else {
        const record = elements.get(entry.target);
        if (!record) continue;
        const mobile = window.matchMedia("(max-width:700px)").matches;
        const compactWidth = Number(
          (entry.target as HTMLElement).dataset.compactWidth,
        );
        const measuredWidth = mobile ? compactWidth : record.naturalWidth;
        if (!Number.isFinite(measuredWidth) || measuredWidth < 0) continue;
        record.code.style.minWidth = `${Math.ceil(measuredWidth)}px`;
        const scroll = needsScroll(measuredWidth, codeViewport(width));
        (entry.target as HTMLElement).dataset.scrollExpected = String(scroll);
      }
    }
  });
  for (const panel of elements.keys()) resize.observe(panel);
  if (lede) resize.observe(lede);
  document.documentElement.dataset.pretext = "ready";
}
measuredPanels().catch(() => {
  // Readable, native CSS layout also works without optional measurement support.
  document.documentElement.dataset.pretext = "unavailable";
});
