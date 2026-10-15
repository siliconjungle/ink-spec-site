# Ink documentation

[Live site](https://siliconjungle.github.io/ink-spec-site/) · [Language reference](https://siliconjungle.github.io/ink-spec-site/reference.html) · [Performance evidence](https://siliconjungle.github.io/ink-spec-site/performance.html)

A concise introduction to compiling state and computation together, with runnable price-table and ordered-query examples, a JavaScript interface and an explanation of reusable optimisation knowledge. The homepage and guide describe the wider direction of optimising application logic, queries, storage and CPU/Wasm/GPU execution together, distinguishing present capabilities from future storage execution. The 25-topic implementation reference, implementation status and benchmark evidence stay linked from the front page. Wider proposals and historical overviews are kept in a separate design-draft download.

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

- `content/home.md`: concise language introduction, state/query examples and the broader execution direction on the front page; the opening copy lives in `scripts/generate.mjs`.
- `content/guide.md`: the detailed application, JavaScript/JSON, optimisation and target guide at `guide.html`. Previous homepage section links redirect here when their sections have moved.
- `content/readable-spec.md`: supported-language reference, reviewed against the published compiler revision; unsupported proposals are identified explicitly.
- `content/performance.md`: separately attributed compiler/planner, fixed-compiler knowledge, JSON/state and lifecycle results, plus current selection policy. Historical measurements keep their original evidence boundaries.
- `content/spec.md`: committed compiler draft, with absolute links for the download.
- `content/implementation.json`: exact published distribution used for the reference review and synced draft.
- `content/environment.json`: independently versioned editor, with the same distribution revision. The workflow reads this pin; installation checks built provenance.
- `scripts/check-reference.mjs`: compile every supported Ink example through the pinned browser compiler, then execute the homepage bound calls and checkpoint/restore.
- `scripts/generate.mjs`: semantic HTML, syntax highlighting, downloads and build information.
- `src/style.css`: reading layout; `src/main.ts`: copying and cached text measurement.

After editing Markdown, rerun `npm run generate`; production previews need a rebuild.

To update the draft from an Ink checkout:

```sh
npm run sync:reference -- /path/to/ink-lang origin/main
npm run build
```

Fetch the published compiler branch first. The sync command reads committed Git bytes and records their revision; an optional revision argument selects those bytes. Review the guide and reference against that revision when capabilities change; syncing the draft alone does not rewrite those explanations. Check every supported Ink example and host example before publishing. `public/prices.ink` is generated from the homepage example and can be compiled directly. `public/ink-specification.md` downloads the implementation reference; `public/ink-design-draft.md` downloads the separate source design draft. `build-info.json` records the site commit and linked compiler revision.

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

`dist-pages/` uses `/ink-spec-site/` as its base. The introduction, guide, reference, performance evidence and JSON flow entry points, fonts, scripts and downloads work under that path. Local `dist/` remains a separate root-path preview. Vite's entry points are defined in `vite.config.ts`.

The [browser environment](https://siliconjungle.github.io/ink-spec-site/environment/)
is built from the exact `ink-environment` revision pinned in the Pages workflow.
Deployment builds its checker and target emitters, runtime/planner and browser
Clang assets, validates them, and installs the static app at `environment/`.
For a local full-site preview, build that package and run
`node scripts/install-environment.mjs /path/to/ink-environment/dist/app dist-pages/environment`
after `npm run build:pages`. Code and inputs stay in the browser.

## Versioned updates and licensing

Reference links use `{{ink_revision}}`, resolved from `content/implementation.json` at generation, so the footer, body links and downloadable reference describe one reviewed source revision. Syncing the design draft updates its source pin; it does not edit the handwritten guide or reference. Review those files, update the editor and its `ink-pins.json`, set `content/environment.json`, and run the example checks before publishing. The editor and reference distributions must match. Historical research reports retain their acquired revisions.

```sh
cargo build --locked --manifest-path /path/to/ink-environment/compiler/Cargo.toml --bin ink-browser-check
npm run check:reference -- /path/to/ink-environment/compiler/target/debug/ink-browser-check /path/to/ink-lang/target/debug/ink
```

This site and its project-authored content are [MIT licensed](LICENSE). Font and third-party runtime notices are shipped separately in `third-party-notices.txt`. The independently maintained [editor repository](https://github.com/siliconjungle/ink-environment) is also MIT licensed. Build manifests identify the exact site, language and editor revisions.

The docs generator imports Ink/JSON highlighting and whitespace/lossless formatting
from the environment package's `syntax` export. Its exact Git dependency must match
`content/environment.json`'s editor revision; generation enforces this binding.
This keeps documentation examples and editable source/data on the same lexer.
Illustrative snippets retain their labels even when colored; highlighting does not
claim that the separately pinned compiler accepts every draft or newer CLI form.
