import { readFile, writeFile, mkdir } from "node:fs/promises";
import { marked, Renderer } from "marked";
import { execFileSync } from "node:child_process";

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
  return `<div class="code-panel"><button type="button" class="copy" aria-label="Copy ${esc(label)} example" data-copy="${id}">copy</button><pre tabindex="0" aria-label="${esc(label)} example"><code id="${id}">${label.startsWith("Terminal") ? esc(text) : highlight(text)}</code></pre></div>`;
}
const renderer = new Renderer();
renderer.code = ({ text, lang }) => codePanel(text,
  lang === "sh" ? "Terminal" : lang === "ink" ? "Ink · supported syntax" :
  /^(module\s*=|proof_script\s*=)/.test(text) ? "Grammar · EBNF" :
  /^ink check/.test(text) ? "Terminal · proposed commands" :
  /^(maintain\(|sum_values\(|new_cached_total)/.test(text) ? "Proof · schematic" :
  /^(Observe|Source modules|Logical state:|Begin\(S\)|change\(S,|init\(program)/.test(text) ? "Semantics · schematic" :
  "Ink · draft syntax");
renderer.table = function (token) {
  return `<div class="table-scroll" role="region" tabindex="0" aria-label="Documentation table">${Renderer.prototype.table.call(this, token)}</div>`;
};
renderer.html = ({ text }) => esc(text);
marked.use({ renderer, gfm: true });

const read = (name) => readFile(new URL(`../content/${name}`, import.meta.url), "utf8");
const spec = await read("spec.md");
const reference = await read("readable-spec.md");
const guide = await read("guide.md");
const implementation = JSON.parse(await read("implementation.json"));
const siteRevision = process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function sections(markdown, numbered = false) {
  const chapters = [...markdown.matchAll(/^## (.+)$/gm)];
  if (!chapters.length) throw new Error("No documentation sections.");
  if (numbered && chapters.length !== 25) throw new Error("Expected all 25 reference topics.");
  return chapters.map((m, i) => {
    const title = numbered ? m[1].replace(/^\d+ /, "") : m[1];
    const id = numbered ? `chapter-${m[1].split(" ")[0]}` : slug(title);
    const text = markdown.slice(m.index + m[0].length, chapters[i + 1]?.index ?? markdown.length).trim();
    return `<section class="chapter" id="${id}" aria-labelledby="title-${id}"><h2 id="title-${id}">${esc(title)}</h2><div class="prose">${marked.parse(text)}</div></section>`;
  }).join("\n");
}
const hello = `module totals;

fn total(xs: List<u64>) -> u64 {
    return sum(xs.map(fn(x) => x * 3 + 7));
}`;
function page(title, body, skip = "guide") {
  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="description" content="Ink: typed programs, composable checked optimisations, and CPU/Wasm/GPU execution."><title>${title}</title><link rel="icon" type="image/svg+xml" href="%BASE_URL%favicon.svg"></head>
<body><a class="skip" href="#${skip}">Skip to the content</a><main class="site-shell">${body}
<footer class="source-link"><a href="https://github.com/siliconjungle/ink-lang">Compiler</a><a href="https://github.com/siliconjungle/ink-spec-site">Site source</a><a href="${implementation.repository}/tree/${implementation.revision}">Implementation ${implementation.revision.slice(0, 7)}</a></footer>
</main><div id="copy-status" class="sr-only" aria-live="polite"></div><script type="module" src="/src/main.ts"></script></body></html>`;
}
const guideBody = `<h1 id="ink-title">ink</h1>
<div class="intro" id="purpose"><p data-measure>A programming language with a small semantic core and a growing store of checked optimisations.</p>
<p>Write typed programs for computation and state. Reusable proofs let the planner combine, replace or skip work; the core checks that each change preserves the program's meaning.</p>
<p class="status-note">Working prototype. Native, Wasm and GPU subsets run today; the full language is still a draft.</p></div>
<nav class="reading-links" aria-label="Documentation"><a href="#get-started">Get started</a><a href="%BASE_URL%reference.html">Language reference</a><a href="https://github.com/siliconjungle/ink-lang">GitHub</a></nav>
${codePanel(hello, "totals.ink · supported today")}
<div id="guide" class="chapters">${sections(guide)}</div>`;
await writeFile(new URL("../index.html", import.meta.url), page("ink — programming language", guideBody));
codeIndex = 0;
const referenceBody = `<h1 class="reference-title">ink <span>/ reference</span></h1>
<div class="intro"><p data-measure>The language design, from values and transactions to proofs and execution.</p><p>This reference includes proposed syntax. For the working subset, start with the <a href="%BASE_URL%index.html">practical guide</a> and <a href="${implementation.repository}/blob/${implementation.revision}/STATUS.md">implementation status</a>.</p></div>
<nav class="reading-links" aria-label="Reference topics"><a href="#chapter-3">Types</a><a href="#chapter-5">State</a><a href="#chapter-8">Proofs</a><a href="#chapter-12">Knowledge</a><a href="#chapter-20">Grammar</a><a href="%BASE_URL%ink-specification.md" download>Full draft</a></nav>
<div id="specification" class="chapters">${sections(reference, true)}</div>`;
await writeFile(new URL("../reference.html", import.meta.url), page("ink — language reference", referenceBody, "specification"));
await mkdir(new URL("../public", import.meta.url), { recursive: true });
await writeFile(new URL("../public/ink-specification.md", import.meta.url), spec);
await writeFile(new URL("../public/totals.ink", import.meta.url), hello + "\n");
await writeFile(new URL("../public/build-info.json", import.meta.url), JSON.stringify({
  schema: 1, site_revision: siteRevision, implementation,
}, null, 2) + "\n");
console.log("Generated the practical guide, 25-topic reference and pinned draft download.");
