# ink — language specification

A minimal dark reference for Ink's complete intended language. Large typography, 25 linked chapters, 22 code panels with a custom Ink lexer, selectable code, copy controls and a downloadable draft. The purpose and status sections explain the idea and distinguish the working prototype from the future language.

The website source lives in this private personal repository. It has no hosted deployment or third-party runtime requests; the generated site, font and JavaScript are local assets.

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

## Edit

- `content/spec.md` is the full draft source. It is a snapshot of `siliconjungle/ink-lang/docs/language-specification-draft.md` at compiler repository commit `711947af48e7b60c7d546943e397d54227be34af`, with the obsolete naming/implementation paragraph corrected, proposed commands renamed to `ink`, and the small-core/database requirement made explicit.
- `scripts/generate.mjs` renders every chapter and highlights fenced syntax at build time. It also writes the raw draft download and the supported `totals.ink` example.
- `src/style.css` contains the design and responsive rules.
- `src/main.ts` contains copy controls, navigation and Pretext measurement.
- `src/layout.ts` contains the numeric layout helpers checked by FreeRange.

After changing the Markdown or generator, rerun `npm run generate` (or restart `npm run dev`). CSS and TypeScript use Vite hot reload in development. Production previews need a rebuild and browser reload.

## Pretext and FreeRange

[Pretext](https://github.com/chenglou/pretext) prepares text once after the named font loads. Cached measurements predict the intro paragraph's height, set code-panel minimum widths, and identify panels that need horizontal scrolling. Resizes reuse the prepared text; ordinary semantic HTML and CSS still render the document. Font loading or measurement failure leaves a readable document.

[FreeRange](https://github.com/chenglou/freerange) statically checks the sizing helpers. Run `npm run audit:layout` to inspect their requirements and proved bounds. Runtime browser dimensions and imported measurements are validated before those helpers receive them. Its scope is those four numeric helpers; this is not a claim that it verifies the entire browser layout, Ink compiler or language proofs.

```sh
npm run check
npm run audit:layout
```

Build-time Markdown rendering preserves the complete 25-chapter draft. The draft still contains unresolved grammar and proof-calculus work; it is not a finished formal language standard. Current executable capabilities are documented separately in [Ink's implementation status](https://github.com/siliconjungle/ink-lang/blob/main/STATUS.md).

## Design

Inspired by Hunchroom's restrained typography and straightforward navigation. All syntax colours are defined locally; there is no generic language highlighter or canvas-only text. IBM Plex Mono is bundled from Fontsource under its included SIL Open Font License.
