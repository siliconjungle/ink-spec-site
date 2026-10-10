import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Usage: npm run sync:reference -- /path/to/ink-lang');
const root = resolve(source);
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const revision = git('rev-parse', 'HEAD');
// Read committed bytes so the recorded revision describes the actual download.
const draft = git('show', `${revision}:docs/language-specification-draft.md`)
  .replace(/\]\((?!https?:|#)([^)]+)\)/g, (_match, target) => {
    const url = new URL(target, `https://github.com/siliconjungle/ink-lang/blob/${revision}/docs/`);
    return `](${url.href})`;
  });
await writeFile(new URL('../content/spec.md', import.meta.url), draft + '\n');
await writeFile(new URL('../content/implementation.json', import.meta.url), JSON.stringify({
  repository: 'https://github.com/siliconjungle/ink-lang',
  revision,
  draft: 'docs/language-specification-draft.md',
}, null, 2) + '\n');
console.log(`Synced the committed draft at ${revision}.`);
