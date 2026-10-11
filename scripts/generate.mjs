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
  return `<div class="code-panel"><button type="button" class="copy" aria-label="Copy ${esc(label)} example" data-copy="${id}">copy</button><pre tabindex="0" aria-label="${esc(label)} example"><code id="${id}">${label.startsWith("Terminal") || label === "JavaScript" || label === "Schematic" ? esc(text) : highlight(text)}</code></pre></div>`;
}
const renderer = new Renderer();
renderer.code = ({ text, lang }) => codePanel(text,
  lang === "sh" ? "Terminal" : lang === "ink" ? "Ink · supported syntax" :
  lang === "js" ? "JavaScript" : lang === "text" ? "Schematic" :
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
function page(title, body, skip = "guide", landing = false) {
  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="description" content="State is a program. Compile it. Ink brings typed data, derived results and atomic changes together, with reusable optimisation knowledge checked against your code."><title>${title}</title><link rel="icon" type="image/svg+xml" href="%BASE_URL%favicon.svg"></head>
<body${landing ? ' class="landing"' : ''}><a class="skip" href="#${skip}">Skip to the content</a><main class="site-shell">${body}
${landing ? '' : `<footer class="source-link"><a href="https://github.com/siliconjungle/ink-lang">Compiler</a><a href="${implementation.repository}/tree/${implementation.revision}">Implementation ${implementation.revision.slice(0, 7)}</a></footer>`}
</main><div id="copy-status" class="sr-only" aria-live="polite"></div><script type="module" src="/src/main.ts"></script></body></html>`;
}
const guideBody = `<h1 id="ink-title">ink</h1>
<div class="intro" id="purpose"><p><strong>State is a program. Compile it.</strong></p>
<p>Define your data, the results derived from it, and the changes it allows. Ink compiles those pieces together.</p>
</div>
<nav class="reading-links" aria-label="Explore Ink"><a href="https://github.com/siliconjungle/ink-lang">Explore the code ↗</a><a href="%BASE_URL%reference.html">Read the reference</a></nav>
<div id="guide" class="chapters">${sections(guide)}</div>`;
await writeFile(new URL("../index.html", import.meta.url), page("ink — state is a program", guideBody, "purpose", true));
codeIndex = 0;
const referenceBody = `<h1 class="reference-title">ink <span>/ reference</span></h1>
<div class="intro"><p data-measure>The supported language: values, state, changes and compilation.</p><p>Reviewed against <a href="${implementation.repository}/tree/${implementation.revision}">published implementation ${implementation.revision.slice(0, 7)}</a>. The Ink examples on this page have been checked with the compiler. See <a href="${implementation.repository}/blob/${implementation.revision}/STATUS.md">implementation status</a> for coverage, or the separate <a href="%BASE_URL%ink-design-draft.md" download>design draft</a> for wider proposals and historical overviews.</p></div>
<nav class="reading-links" aria-label="Reference topics"><a href="#chapter-3">Types</a><a href="#chapter-5">State</a><a href="#chapter-8">Proofs</a><a href="#chapter-12">Knowledge</a><a href="#chapter-20">Syntax</a><a href="%BASE_URL%ink-specification.md" download>Download reference</a></nav>
<div id="specification" class="chapters">${sections(reference, true)}</div>`;
await writeFile(new URL("../reference.html", import.meta.url), page("ink — language reference", referenceBody, "specification"));
await mkdir(new URL("../public", import.meta.url), { recursive: true });
await writeFile(new URL("../public/ink-specification.md", import.meta.url), `# Ink implementation reference\n\nReviewed against [published implementation ${implementation.revision.slice(0, 7)}](${implementation.repository}/tree/${implementation.revision}). This describes supported behaviour; wider proposals and historical overviews are in the [separate design draft](https://siliconjungle.github.io/ink-spec-site/ink-design-draft.md).\n\n${reference}`);
await writeFile(new URL("../public/ink-design-draft.md", import.meta.url), spec);
await writeFile(new URL("../public/totals.ink", import.meta.url), hello + "\n");
const prices = guide.match(/```ink\n([\s\S]*?)\n```/)?.[1];
if (!prices) throw new Error("Missing homepage program.");
await writeFile(new URL("../public/prices.ink", import.meta.url), prices + "\n");
await writeFile(new URL("../public/build-info.json", import.meta.url), JSON.stringify({
  schema: 1, site_revision: siteRevision, implementation,
}, null, 2) + "\n");
console.log("Generated the Ink introduction, 25-topic implementation reference and separate pinned design draft.");
