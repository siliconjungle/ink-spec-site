import { readFile, writeFile, mkdir } from "node:fs/promises";
import { marked, Renderer } from "marked";
import { execFileSync } from "node:child_process";
import {highlightCode, formatInk, formatJSON} from "@siliconjungle/ink-environment/syntax";

const esc = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
let codeIndex = 0;
function codePanel(text, label = "Ink · draft syntax", language = "ink") {
  const id = `code-${++codeIndex}`;
  if(language==="ink" && /^module\s/.test(text)){try{text=formatInk(text);}catch{ /* Incomplete drafts remain readable. */ }}
  if(language==="json"){try{text=formatJSON(text);}catch{ /* Show invalid examples verbatim. */ }}
  const rendered=language?highlightCode(text,language):esc(text);
  return `<div class="code-panel"><button type="button" class="copy" aria-label="Copy ${esc(label)} example" data-copy="${id}">copy</button><pre tabindex="0" aria-label="${esc(label)} example"><code id="${id}">${rendered}</code></pre></div>`;
}
const renderer = new Renderer();
renderer.code = ({text,lang}) => {
  const inkSnippet=/^\s*(?:module|trainable|adaptive|learn|state|keep|change|query|record|enum|fn|let|var|return)\b/.test(text);
  const label=lang==="sh"?"Terminal":lang==="ink-cli"?"Ink · current CLI syntax":lang==="ink"?"Ink · supported syntax":
    ["js","javascript"].includes(lang)?"JavaScript":lang==="json"?"JSON":
    lang==="text"?(inkSnippet?"Ink · illustrative syntax":"Schematic"):
    /^(module\s*=|proof_script\s*=)/.test(text)?"Grammar · EBNF":
    /^ink check/.test(text)?"Terminal · proposed commands":
    /^(maintain\(|sum_values\(|new_cached_total)/.test(text)?"Proof · schematic":
    /^(Observe|Source modules|Logical state:|Begin\(S\)|change\(S,|init\(program)/.test(text)?"Semantics · schematic":"Ink · draft syntax";
  const language=label.startsWith("Ink")?"ink":label==="JavaScript"?"javascript":label==="JSON"?"json":null;
  return codePanel(text,label,language);
};
renderer.table = function (token) {
  return `<div class="table-scroll" role="region" tabindex="0" aria-label="Documentation table">${Renderer.prototype.table.call(this, token)}</div>`;
};
renderer.html = ({ text }) => esc(text);
marked.use({ renderer, gfm: true });

const implementation = JSON.parse(await readFile(new URL('../content/implementation.json', import.meta.url), 'utf8'));
const environment = JSON.parse(await readFile(new URL('../content/environment.json', import.meta.url), 'utf8'));
for (const value of [implementation.revision, environment.revision, environment.distribution]) {
  if (!/^[a-f0-9]{40}$/.test(value)) throw Error('Documentation pins must be exact Git revisions');
}
if (environment.distribution !== implementation.revision) throw Error('Reference and browser editor must describe the same distribution');
const syntaxPackage=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).devDependencies['@siliconjungle/ink-environment'];
if(!syntaxPackage.endsWith('#'+environment.revision))throw Error('Docs highlighter and embedded environment must use the same exact revision');
const read = async (name) => (await readFile(new URL(`../content/${name}`, import.meta.url), "utf8"))
  .replaceAll('{{ink_revision}}', implementation.revision);
const spec = await read("spec.md");
const reference = await read("readable-spec.md");
const guide = await read("guide.md");
const home = await read("home.md");
const performance = await read("performance.md");
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
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="description" content="Ink is a typed language for state and computation, with locally checked optimisation proofs and an independently growing knowledge database. Explore the working prototype, language reference and measured results."><title>${title}</title><link rel="icon" type="image/svg+xml" href="%BASE_URL%favicon.svg"></head>
<body${landing ? ' class="landing"' : ''}><a class="skip" href="#${skip}">Skip to the content</a><main class="site-shell">${body}
<footer class="source-link"><a href="%BASE_URL%ink-license.txt">MIT licensed</a><a href="%BASE_URL%third-party-notices.txt">Third-party notices</a><a href="${implementation.repository}/tree/${implementation.revision}">Language ${implementation.revision.slice(0, 7)}</a><a href="${environment.repository}/tree/${environment.revision}">Editor ${environment.revision.slice(0, 7)}</a><a href="%BASE_URL%build-info.json">Build versions</a></footer>
</main><div id="copy-status" class="sr-only" aria-live="polite"></div><script type="module" src="/src/main.ts"></script></body></html>`;
}
const homeBody = `<h1 id="ink-title">ink</h1>
<div class="intro" id="purpose"><p><strong>State is a program. Compile it.</strong></p>
<p>Ink is a typed language for data and the computation around it. Define state, derived results and atomic changes, then compile them together. Selected state can learn from feedback, under objectives and constraints you define.</p>
<p>Ordinary code and queries can describe one connected computation. The ambition is to optimise across application logic, storage and CPU/Wasm/GPU execution, reducing the work and data movement between layers.</p>
<p>Ink's planner searches a growing knowledge library, composing optimisations backed by checked proofs that preserve your program's meaning. As the library grows, those optimisations can compound: rebuilding the same code with the same compiler can produce a better implementation.</p>
<p class="status-note">Open source. MIT licensed. Working prototype.</p>
</div>
<nav class="reading-links" aria-label="Explore Ink"><a href="%BASE_URL%environment/">Try Ink</a><a href="#software-that-learns-and-adapts">Adaptive software</a><a href="%BASE_URL%guide.html">Read the guide</a><a href="https://github.com/siliconjungle/ink-lang">Source code</a></nav>
<div id="guide" class="chapters">${sections(home)}</div>
<script type="application/json" id="guide-anchors">${JSON.stringify([...guide.matchAll(/^## (.+)$/gm)].map(m => slug(m[1])))}</script>`;
await writeFile(new URL("../index.html", import.meta.url), page("ink — state is a program", homeBody, "purpose", true));
codeIndex = 0;
const guideBody = `<h1 class="reference-title">ink <span>/ guide</span></h1>
<div class="intro"><p>From a small stateful program to application boundaries and proof-checked optimisation.</p></div>
<nav class="reading-links" aria-label="Guide topics"><a href="%BASE_URL%">Introduction</a><a href="#bring-it-into-your-app">Embedding Ink</a><a href="#javascript-values-without-json">JavaScript values</a><a href="#json-across-boundaries">JSON</a><a href="%BASE_URL%reference.html">Reference</a><a href="%BASE_URL%performance.html">Performance</a></nav>
<div id="guide" class="chapters">${sections(guide)}</div>`;
await writeFile(new URL("../guide.html", import.meta.url), page("ink — guide", guideBody));
codeIndex = 0;
const referenceBody = `<h1 class="reference-title">ink <span>/ reference</span></h1>
<div class="intro"><p data-measure>The supported language: values, state, changes and compilation.</p><p>Reviewed against <a href="${implementation.repository}/tree/${implementation.revision}">published implementation ${implementation.revision.slice(0, 7)}</a>. The Ink examples on this page have been checked with the compiler. See <a href="${implementation.repository}/blob/${implementation.revision}/STATUS.md">implementation status</a> for coverage, or the separate <a href="%BASE_URL%ink-design-draft.md" download>design draft</a> for wider proposals and historical overviews.</p></div>
<nav class="reading-links" aria-label="Reference topics"><a href="%BASE_URL%">Introduction</a><a href="#chapter-3">Types</a><a href="#chapter-5">State</a><a href="#chapter-8">Proofs</a><a href="#chapter-13">Selection</a><a href="#chapter-20">Syntax</a><a href="%BASE_URL%ink-specification.md" download>Download reference</a></nav>
<div id="specification" class="chapters">${sections(reference, true)}</div>`;
await writeFile(new URL("../reference.html", import.meta.url), page("ink — language reference", referenceBody, "specification"));
codeIndex = 0;
const performanceBody = `<h1 class="reference-title">ink <span>/ performance</span></h1>
<div class="intro"><p>Less work, measured at the boundary that matters.</p><p>Published results include wins, regressions and the cost of getting started. A checked optimisation preserves meaning within its admitted domain; its speed still depends on the program, inputs and target.</p><p class="status-note">Evidence acquired 13–14 October 2026. Each study binds its source revisions, workload and output boundary; later updates do not rerun earlier measurements.</p></div>
<nav class="reading-links" aria-label="Performance topics"><a href="%BASE_URL%">Introduction</a><a href="#compiler-and-planner">Compiler and planner</a><a href="#json-and-state">JSON and state</a><a href="#selection-policy">Selection policy</a><a href="%BASE_URL%reference.html">Reference</a></nav>
<div id="performance" class="chapters">${sections(performance)}</div>`;
await writeFile(new URL('../performance.html', import.meta.url), page('ink — performance evidence', performanceBody, 'performance'));
const jsonBody=`<h1 class="reference-title">ink <span>/ JSON flow</span></h1>
<div class="intro"><p>JSON at the boundary. Compiled values between computers.</p><p>This runs the published <code>mark_received</code> Ink function. It preserves unfamiliar fields and exact numeric tokens. The relay validates and passes the binary buffer onward.</p></div>
<nav class="reading-links" aria-label="JSON resources"><a href="%BASE_URL%guide.html#json-across-boundaries">Read the guide</a><a href="%BASE_URL%documents.ink">Download the source</a><a href="${implementation.repository}/blob/${implementation.revision}/docs/json-and-portable-values.md">Representation contract</a></nav>
<section class="chapter" id="json-flow"><h2>Keep the value compiled</h2><div class="prose"><label for="json-input">Input JSON</label><textarea id="json-input" spellcheck="false" rows="7">{"title":"hello","unknown":{"amount":123456789012345678901234567890,"scale":1e10000},"nullable":null}</textarea><label><input type="checkbox" id="json-compact"> Use compact transport with a shared schema</label><button type="button" id="json-run">Run the compiled flow</button><p id="json-status" role="status" aria-live="polite">Loading the compiled program…</p><div class="code-panel" data-native-wrap><pre aria-label="Output JSON"><code id="json-output"></code></pre></div><p>The path is parse → binary request → validated relay → compiled modification → binary reply → JSON output. This demo stays in your browser; an application supplies its own network transport.</p><p>Compact transport omits per-message schema hashes and frame lengths. Both peers must agree on the exact argument/result schemas and transport version before using it. Portable transport identifies the schema in every message.</p><p>Compiled calls materialize target values. This demonstrates portable binary interoperability, without claiming zero-copy execution or a measured speedup.</p></div></section>`;
await writeFile(new URL('../json.html',import.meta.url),page('ink — JSON and compiled values',jsonBody,'json-flow').replace('</body>','<script type="module" src="/src/json-demo.ts"></script></body>'));
await mkdir(new URL("../public", import.meta.url), { recursive: true });
await writeFile(new URL("../public/ink-specification.md", import.meta.url), `# Ink implementation reference\n\nReviewed against [published implementation ${implementation.revision.slice(0, 7)}](${implementation.repository}/tree/${implementation.revision}). This describes supported behaviour; wider proposals and historical overviews are in the [separate design draft](https://siliconjungle.github.io/ink-spec-site/ink-design-draft.md).\n\n${reference}`);
await writeFile(new URL("../public/ink-design-draft.md", import.meta.url), spec);
await writeFile(new URL("../public/totals.ink", import.meta.url), hello + "\n");
const prices = home.match(/```ink\n([\s\S]*?)\n```/)?.[1];
if (!prices) throw new Error("Missing homepage program.");
await writeFile(new URL("../public/prices.ink", import.meta.url), prices + "\n");
await writeFile(new URL("../public/build-info.json", import.meta.url), JSON.stringify({
  schema: 1, site_revision: siteRevision, implementation,
  environment,
}, null, 2) + "\n");
await writeFile(new URL('../public/ink-license.txt', import.meta.url), await readFile(new URL('../LICENSE', import.meta.url), 'utf8'));
const documents=guide.match(/```ink\n(module documents;[\s\S]*?)\n```/)?.[1];
if(!documents)throw Error('Missing JSON program');
await writeFile(new URL('../public/documents.ink',import.meta.url),documents+'\n');
console.log("Generated the Ink introduction, 25-topic implementation reference and separate pinned design draft.");

const notices = [];
for (const [name, path] of [['Pretext', '@chenglou/pretext/LICENSE'], ['IBM Plex Mono', '@fontsource/ibm-plex-mono/LICENSE']]) {
  notices.push(`${name}\n${await readFile(new URL('../node_modules/' + path, import.meta.url), 'utf8')}`);
}
await writeFile(new URL('../public/third-party-notices.txt', import.meta.url), notices.join('\n\n'));
