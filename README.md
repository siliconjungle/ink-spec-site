# Ink documentation

[Live guide](https://siliconjungle.github.io/ink-spec-site/) · [Language reference](https://siliconjungle.github.io/ink-spec-site/reference.html)

A short practical guide to Ink, with runnable examples and links to the implementation. The full 25-topic design reference and Markdown draft stay one click away. Proposed syntax is kept in the reference; the front-page examples use the working compiler.

The site keeps a simple dark reading layout, local syntax highlighting, copy controls and bundled fonts. It makes no third-party runtime requests.

## Develop

Node 22.12+ is required (tested on 22.22.1).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4318. Production checks and preview:

```sh
npm run build
npm run preview
```

## Edit and sync

- `content/guide.md`: short front page.
- `content/readable-spec.md`: full design reference, including proposed syntax.
- `content/spec.md`: committed compiler draft, with absolute links for the download.
- `content/implementation.json`: exact compiler revision described by the draft.
- `scripts/generate.mjs`: semantic HTML, syntax highlighting, downloads and build information.
- `src/style.css`: reading layout; `src/main.ts`: copying and cached text measurement.

After editing Markdown, rerun `npm run generate`; production previews need a rebuild.

To update the draft from an Ink checkout:

```sh
npm run sync:reference -- /path/to/ink-lang
npm run build
```

The sync command reads committed Git bytes and records their revision. Review the guide and reference when capabilities change; syncing the draft alone does not rewrite those explanations. `build-info.json` on the deployed site records both its own commit and the compiler revision, so freshness can be checked directly.

Pretext measures text after the bundled IBM Plex Mono font loads. FreeRange checks the four numeric layout helpers in `src/layout.ts`; it does not verify browser layout or Ink's compiler. Measurement failure leaves ordinary HTML/CSS readable.

```sh
npm run check
npm run audit:layout
```

## Deploy

Pushes to `main` run `.github/workflows/pages.yml`, which builds, checks and deploys GitHub Pages. The manual build is:

```sh
npm run build:pages
```

`dist-pages/` uses `/ink-spec-site/` as its base. The two HTML entry points, fonts, scripts and downloads work under that path. Local `dist/` remains a separate root-path preview. Vite's entry points are defined in `vite.config.ts`.
