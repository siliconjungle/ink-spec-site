import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const compiler = process.argv[2];
const languageCompiler = process.argv[3];
if (!compiler) throw Error('Usage: node scripts/check-reference.mjs /path/to/ink-browser-check');
const directory = await mkdtemp(join(tmpdir(), 'ink-reference-'));
let checked = 0;
try {
  for (const file of ['guide.md', 'readable-spec.md']) {
    const text = await readFile(new URL(`../content/${file}`, import.meta.url), 'utf8');
    for (const match of text.matchAll(/```ink\n([\s\S]*?)\n```/g)) {
      const source = match[1];
      if (!source.startsWith('module ')) throw Error(`${file}: supported example must be a complete module`);
      if (/\bimport\s+"/.test(source)) {
        if (!languageCompiler) throw Error('Linked examples require the second argument: the pinned Ink CLI');
        const sourcePath = join(directory, `linked-${checked}.ink`);
        await writeFile(sourcePath, source);
        const linked = spawnSync(resolve(languageCompiler), ['check', sourcePath], {encoding:'utf8'});
        if (linked.status !== 0) throw Error(`${file}: ${linked.stderr}`);
        ++checked;
        continue;
      }
      const result = spawnSync(resolve(compiler), [], {
        input: JSON.stringify({op:'compile', source}), encoding:'utf8', maxBuffer:16*1024*1024,
      });
      const reply = JSON.parse(result.stdout || '{}');
      if (result.status !== 0 || !reply.ok) throw Error(`${file}: ${reply.error || result.stderr}`);
      ++checked;
      const modulePath = join(directory, `example-${checked}.mjs`);
      await writeFile(modulePath, reply.ok.javascript);
      if (file === 'guide.md' && checked === 1) {
        const {createState} = await import(pathToFileURL(modulePath).href);
        const state = createState();
        const setPrice = state.bind('set_price');
        const total = state.bind('total', {resultOnly:true});
        setPrice(1n, 40n); setPrice(2n, 60n);
        if (total() !== 100n) throw Error('Homepage host example: expected 100n');
        setPrice(1n, 45n);
        if (total() !== 105n) throw Error('Homepage host example: expected 105n');
        const restored = createState();
        await restored.restore(await state.checkpoint());
        if (restored.invoke('total', []).result !== 105n) throw Error('Reference snapshot host example failed');
      }
    }
  }
  console.log(`Checked ${checked} complete Ink examples with the pinned browser/CLI compilers, bound JavaScript calls and checkpoint/restore.`);
} finally {
  await rm(directory, {recursive:true, force:true});
}
