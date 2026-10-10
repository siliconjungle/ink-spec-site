# ink — language specification

A minimal dark reading guide to Ink. Large typography, 25 language topics, 20 code examples on rounded, subtly lighter backgrounds with custom highlighting, and a downloadable full draft. The introduction explains the purpose and makes clear that the current compiler implements only part of the design. There are no framed prose cards, decorative arrows, dividers, metadata labels or top navigation bar.

The website is published at [siliconjungle.github.io/ink-spec-site](https://siliconjungle.github.io/ink-spec-site/) from this public personal repository. It makes no third-party runtime requests; the generated site, font and JavaScript are bundled assets.

## Run locally

Requires Node 22.12+ (tested on 22.22.1).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4318. The server binds to loopback only.

```sh
npm run build
npm run preview
```

The static production output is `dist/`. The preview uses the same address.

## GitHub Pages

Pushes to `main` run `.github/workflows/pages.yml`, which builds, checks and deploys the static page. The workflow can also be started manually from GitHub Actions.

```sh
npm run build:pages
```

The Pages build uses `/ink-spec-site/` as its base and writes `dist-pages/`. The separate output keeps the local preview in `dist/` working at its usual root URL. Downloads, fonts and scripts work beneath the project URL.

## Edit

- `content/spec.md` mirrors the current Ink design draft, including the implemented subset and the separate core/database/backend architecture. Links to compiler documentation use absolute GitHub URLs so they also work in the downloadable copy.
- `content/readable-spec.md` is the shorter page text: the same 25 topics, written directly with the syntax examples retained. The two schematic arrow diagrams are explained in prose instead. The full draft download remains unchanged.
- `scripts/generate.mjs` renders every chapter and highlights fenced syntax at build time. It also writes the raw draft download and the supported `totals.ink` example.
- `src/style.css` contains the design and responsive rules.
- `src/main.ts` contains copy controls, Pretext measurement.
- `src/layout.ts` contains the numeric layout helpers checked by FreeRange.

After changing the Markdown or generator, rerun `npm run generate` (or restart `npm run dev`). CSS and TypeScript use Vite hot reload in development. Production previews need a rebuild and browser reload.

## Pretext and FreeRange

[Pretext](https://github.com/chenglou/pretext) prepares text once after the named font loads. Cached measurements predict the intro paragraph's height, set code-panel minimum widths, and identify panels that need horizontal scrolling. Resizes reuse the prepared text; ordinary semantic HTML and CSS still render the document. Font loading or measurement failure leaves a readable document.

[FreeRange](https://github.com/chenglou/freerange) statically checks the sizing helpers. Run `npm run audit:layout` to inspect their requirements and proved bounds. Runtime browser dimensions and imported measurements are validated before those helpers receive them. Its scope is those four numeric helpers; this is not a claim that it verifies the entire browser layout, Ink compiler or language proofs.

```sh
npm run check
npm run audit:layout
```

Build-time Markdown rendering preserves all 25 topics. The download preserves the complete original draft. The draft still contains unresolved grammar and proof-calculus work; it is not a finished formal language standard. Current executable capabilities are documented separately in [Ink's implementation status](https://github.com/siliconjungle/ink-lang/blob/main/STATUS.md).

## Design

Inspired by Hunchroom's restrained typography. Sections are separated by whitespace. Code has rounded corners and a separate dark background. All syntax colours are defined locally; there is no generic language highlighter or canvas-only text. IBM Plex Mono is bundled from Fontsource under its included SIL Open Font License.
