import { readFile, writeFile, mkdir } from "node:fs/promises";
import { marked, Renderer } from "marked";

const esc = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const keywords = new Set(
  "module import pub id record enum type fn partial let var return if else match for in while state event keep change query reads writes emits emit requires ensures where theorem by rewrite from to proof implementation representation abstraction initialise step observe certificate normalize arithmetic induction cases intro exact apply".split(
    " ",
  ),
);
const types = new Set(
  "Unit Bool Int Nat String Bytes Option Result List Array Set Map Table Buffer Prop Proof u8 u16 u32 u64 i8 i16 i32 i64 f32 f64".split(
    " ",
  ),
);
// A small lexical highlighter for Ink. No expression evaluation or HTML input.
function highlight(text) {
  const pattern =
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|\b(?:0x[\da-fA-F_]+|\d[\d_]*(?:\.\d+)?)\b|\b[A-Za-z_][A-Za-z_\d]*\b|(?:->|=>|==|!=|<=|>=|&&|\|\||[+*?!=<>-])/g;
  let result = "",
    end = 0;
  for (const m of text.matchAll(pattern)) {
    result += esc(text.slice(end, m.index));
    const t = m[0];
    const cls =
      t.startsWith("//") || t.startsWith("/*")
        ? "comment"
        : t.startsWith('"')
          ? "string"
          : /^\d/.test(t)
            ? "number"
            : keywords.has(t)
              ? "keyword"
              : types.has(t) || /^[A-Z]/.test(t)
                ? "type"
                : ["true", "false", "None", "Some", "Ok", "Err"].includes(t)
                  ? "constant"
                  : /^[A-Za-z_]/.test(t)
                    ? /^\s*\(/.test(text.slice(m.index + t.length))
                      ? "function"
                      : ""
                    : "operator";
    result += cls ? `<span class="tok-${cls}">${esc(t)}</span>` : esc(t);
    end = m.index + t.length;
  }
  return result + esc(text.slice(end));
}
let codeIndex = 0;
function codePanel(text, label = "Ink · draft syntax") {
  const id = `code-${++codeIndex}`;
  const lines = text.split("\n").length;
  return `<div class="code-panel"><div class="code-bar"><span>${label}</span><span class="code-meta"><span>${lines} lines</span><span class="scroll-hint" hidden>scroll →</span><button type="button" class="copy" aria-label="Copy ${esc(label)} example" data-copy="${id}">copy</button></span></div><pre tabindex="0" aria-label="${esc(label)} example"><code id="${id}">${highlight(text)}</code></pre></div>`;
}
const renderer = new Renderer();
renderer.code = ({ text }) =>
  codePanel(
    text,
    /^(module\s*=|proof_script\s*=)/.test(text)
      ? "Grammar · EBNF"
      : /^ink check/.test(text)
        ? "Terminal · proposed commands"
        : /^(maintain\(|sum_values\(|new_cached_total)/.test(text)
          ? "Proof · schematic"
          : /^(Observe|Source modules|Logical state:|Begin\(S\)|change\(S,|init\(program)/.test(
                text,
              )
            ? "Semantics · schematic"
            : "Ink · draft syntax",
  );
renderer.table = function (token) {
  return `<div class="table-scroll" role="region" tabindex="0" aria-label="Specification table">${Renderer.prototype.table.call(this, token)}</div>`;
};
renderer.html = ({ text }) => esc(text);
marked.use({ renderer, gfm: true });

const spec = await readFile(
  new URL("../content/spec.md", import.meta.url),
  "utf8",
);
const chapters = [...spec.matchAll(/^## (\d+) (.+)$/gm)];
if (chapters.length !== 25)
  throw new Error("Expected the entire 25-chapter specification.");
const shortNames = [
  "Design commitments",
  "A complete application",
  "Values & types",
  "Functions",
  "State & changes",
  "Derived computation",
  "Effects",
  "Proofs & contracts",
  "Verification boundaries",
  "Optimisation rules",
  "Representation proofs",
  "Knowledge database",
  "Search & selection",
  "Runtime adaptation",
  "Serialisation",
  "Software as a database",
  "Compiler architecture",
  "Native & WebAssembly",
  "Packages & commands",
  "Surface grammar",
  "Performance evaluation",
  "Implementation stages",
  "Open decisions",
  "Worked certificate",
  "Reference execution",
];
const nav = chapters
  .map(
    (m, i) =>
      `<a href="#chapter-${m[1]}"><span>${m[1].padStart(2, "0")}</span>${shortNames[i]}</a>`,
  )
  .join("");
const sections = chapters
  .map((m, i) => {
    const text = spec
      .slice(m.index + m[0].length, chapters[i + 1]?.index ?? spec.length)
      .trim();
    return `<section class="chapter" id="chapter-${m[1]}" aria-labelledby="title-${m[1]}"><header class="chapter-title"><span class="chapter-number">${m[1].padStart(2, "0")}</span><h2 id="title-${m[1]}">${esc(m[2])}</h2><a class="permalink" href="#chapter-${m[1]}" aria-label="Link to ${esc(m[2])}">↗</a></header><div class="prose">${marked.parse(text)}</div></section>`;
  })
  .join("\n");
const hello = `module totals;

fn total(xs: List<u64>) -> u64 {
    return sum(xs.map(fn(x) => x * 3 + 7));
}`;
const heroCode = codePanel(hello, "totals.ink · supported today");
const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="description" content="Ink: a language for data, changes and computation. Read the full draft specification for a small compiler and an extensible database of checked optimisations."><title>ink — language specification</title><link rel="icon" type="image/svg+xml" href="/favicon.svg"></head>
<body><a class="skip" href="#specification">Skip to the specification</a>
<div class="site-shell"><header class="topbar"><a href="#" class="brand">ink<span> / language specification</span></a><nav aria-label="Main navigation"><a href="#purpose">purpose</a><a href="#specification">spec</a><a href="https://github.com/siliconjungle/ink-spec-site" target="_blank" rel="noopener">github ↗</a></nav></header>
<main><section class="hero" aria-labelledby="ink-title"><div class="hero-meta"><span>Experimental programming language</span><span>Draft 0.1 / October 2026</span></div><div class="hero-heading"><h1 id="ink-title">ink</h1><div class="hero-summary"><h2>Less work.<br> Same meaning.</h2><p data-measure>Describe your data, how it changes, and the result you need. Let checked knowledge find a better way to compute it.</p></div></div><div class="hero-bottom"><span>A small core. An expanding body of knowledge.</span><a href="#chapter-2">Read the syntax <span aria-hidden="true">↓</span></a></div></section>
<section id="purpose" class="purpose" aria-labelledby="purpose-title"><div class="purpose-copy"><span class="eyebrow">Why Ink exists</span><h2 id="purpose-title">Make improvements<br> reusable.</h2><p>Most compilers improve when someone changes the compiler. Ink explores a different route: a small core, with optimisation knowledge stored in a growing database.</p><p>Programs describe logical data and explicit changes. A proof can establish that a fused calculation, a maintained total, or a different representation preserves their meaning. Measurements decide whether it is worth using.</p><p>New knowledge should help existing programs skip more work. It must earn its place twice: by being correct, and by being useful.</p></div><div class="purpose-example">${heroCode}<p class="example-note">Write the computation once. A checked database package can replace intermediate collections with a single traversal.</p><div class="principle"><span>01</span><div><strong>Meaning stays stable.</strong><p>Data layout and algorithms can change. Observable results must agree.</p></div></div><div class="principle"><span>02</span><div><strong>Evidence travels with knowledge.</strong><p>Imported proofs are checked locally. Faster is a separate, measured claim.</p></div></div></div></section>
<section id="status" class="status" aria-labelledby="status-title"><div><span class="eyebrow">Where it stands</span><h2 id="status-title">A real prototype.<br> An unfinished language.</h2></div><div><p>The compiler supports pure <code>u64</code> collection programs and a broader stateful inventory subset, with native and WebAssembly execution. Immutable proof objects can authorise eligible source replacements.</p><p>This page contains the <strong>full intended draft</strong>, including features still to build. Generic functions, refinements, the complete proof surface, automatic adaptation and durable recovery remain unfinished. The current checker and backends are part of the trust boundary.</p><a href="https://github.com/siliconjungle/ink-lang/blob/main/STATUS.md" target="_blank" rel="noopener">Implementation status ↗</a></div></section>
<div id="specification" class="spec-heading"><div><span class="eyebrow">The language, in detail</span><h2>Specification</h2></div><a href="/ink-specification.md" download>Download draft <span aria-hidden="true">↓</span></a></div>
<div class="reference"><aside class="contents"><div class="contents-label">Contents <span>25 sections</span></div><nav aria-label="Specification contents">${nav}</nav></aside><details class="mobile-contents"><summary>Jump to a section <span>25 sections ↓</span></summary><nav aria-label="Mobile specification contents">${nav}</nav></details><div class="chapters">${sections}</div></div>
</main><footer><span class="footer-brand">ink</span><span>Draft 0.1 · Designed to change.</span><div><a href="https://github.com/chenglou/pretext">Pretext</a><span> / </span><a href="https://github.com/chenglou/freerange">FreeRange</a></div></footer></div><div id="copy-status" class="sr-only" aria-live="polite"></div><script type="module" src="/src/main.ts"></script></body></html>`;
await writeFile(new URL("../index.html", import.meta.url), html);
await mkdir(new URL("../public", import.meta.url), { recursive: true });
await writeFile(
  new URL("../public/ink-specification.md", import.meta.url),
  spec,
);
await writeFile(new URL("../public/totals.ink", import.meta.url), hello + "\n");
console.log(
  `Generated ${chapters.length} chapters and ${codeIndex} highlighted code panels.`,
);
