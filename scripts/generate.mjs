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
  return `<div class="code-panel"><button type="button" class="copy" aria-label="Copy ${esc(label)} example" data-copy="${id}">copy</button><pre tabindex="0" aria-label="${esc(label)} example"><code id="${id}">${highlight(text)}</code></pre></div>`;
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
const readingSpec = await readFile(
  new URL("../content/readable-spec.md", import.meta.url),
  "utf8",
);
const chapters = [...readingSpec.matchAll(/^## (\d+) (.+)$/gm)];
if (chapters.length !== 25) throw new Error("Expected all 25 language topics.");
const sections = chapters
  .map((m, i) => {
    const text = readingSpec
      .slice(
        m.index + m[0].length,
        chapters[i + 1]?.index ?? readingSpec.length,
      )
      .trim();
    return `<section class="chapter" id="chapter-${m[1]}" aria-labelledby="title-${m[1]}"><h2 id="title-${m[1]}">${esc(m[2])}</h2><div class="prose">${marked.parse(text)}</div></section>`;
  })
  .join("\n");
const hello = `module totals;

fn total(xs: List<u64>) -> u64 {
    return sum(xs.map(fn(x) => x * 3 + 7));
}`;
const heroCode = codePanel(hello, "totals.ink · supported today");
const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="description" content="Ink: a language for data, changes and computation. A small semantic core, a growing database of checked optimisations and composable CPU/GPU backends."><title>ink — language specification</title><link rel="icon" type="image/svg+xml" href="%BASE_URL%favicon.svg"></head>
<body><a class="skip" href="#specification">Skip to the specification</a>
<main class="site-shell"><h1 id="ink-title">ink</h1>
<div class="intro" id="purpose"><p data-measure>Ink is a programming language for data, changes and the results they produce. It is being built to make software faster by proving which work can be combined, skipped or done differently.</p>
<p>The design keeps the core small. It defines what a program means and checks evidence. A separate, growing database supplies equivalent algorithms and representations. The aim is to extend optimisation by adding knowledge, rather than adding special cases to the compiler.</p>
<p>A program can use several backends together: Wasm and WebGPU in a browser, or native CPU code and wgpu on desktop. Existing C and Rust toolchains produce the machine code. Choosing where work runs includes the cost of moving data and waiting for results.</p>
<p class="status-note">Ink is an experimental implementation. Native, Wasm and GPU subsets run today, including checked pure CPU/GPU call graphs. Full stateful replacement proofs and parts of the syntax below are still being built. Read the <a href="%BASE_URL%ink-specification.md" download>full draft</a> or see <a href="https://github.com/siliconjungle/ink-lang/blob/main/STATUS.md">what works today</a>.</p></div>
${heroCode}
<div id="specification" class="chapters">${sections}</div>
<p class="source-link"><a href="https://github.com/siliconjungle/ink-spec-site">Source on GitHub</a></p>
</main><div id="copy-status" class="sr-only" aria-live="polite"></div><script type="module" src="/src/main.ts"></script></body></html>`;
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
