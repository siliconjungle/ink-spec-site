import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const compiler = process.argv[2];
const languageCompiler = process.argv[3];
if (!compiler) throw Error('Usage: node scripts/check-reference.mjs /path/to/ink-browser-check');
const directory = await mkdtemp(join(tmpdir(), 'ink-reference-'));
let checked = 0;
try {
  for (const file of ['home.md', 'guide.md', 'readable-spec.md']) {
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
      if (source.startsWith('module queries;')) {
        const {functions}=await import(pathToFileURL(modulePath).href);
        assert.deepEqual(functions.selected([3,1,3,2],2),[9,9,6]);
        assert.equal(functions.total([3,1,3,2],2),24);
        assert.deepEqual(functions.selected([],0),[]);
        assert.equal(functions.total([],0),0);
        if(functions.overlap){
          assert.equal(functions.overlap([1,2,2],[3,2]),true);
          assert.equal(functions.overlap([],[2]),false);
        }
      }
      if (source.startsWith('module query_reference;')) {
        const {functions}=await import(pathToFileURL(modulePath).href);
        assert.deepEqual(functions.matches([2,1,2],[2,2,1]),[
          {left:2,right:2},{left:2,right:2},{left:1,right:1},
          {left:2,right:2},{left:2,right:2}]);
        assert.equal(functions.overlap([1,2],[2]),true);
        assert.equal(functions.overlap([],[2]),false);
      }
      if (source.startsWith('module documents;')) {
        const {JsonCodec, valueCodecs, compiledValues, callCompiled} = await import(pathToFileURL(modulePath).href);
        const documents = new JsonCodec(valueCodecs.identity.result);
        const entry = compiledValues.mark_received;
        const input = documents.parseCompiled(entry.params[0], '{"title":"hello","unknown":1e10000}');
        for (const compact of [false,true]) {
          const bytes = compact ? entry.params[0].encodeCompact(input) : entry.params[0].encode(input);
          const saved = bytes.slice();
          const restored = compact ? entry.params[0].decodeCompactFused(bytes) : entry.params[0].decodeFused(bytes);
          assert.deepEqual(entry.params[0].materialize(restored), entry.params[0].materialize(input));
          assert.deepEqual(bytes, saved);
          const bad = saved.subarray(0, saved.length-1);
          assert.throws(() => compact ? entry.params[0].decodeCompactFused(bad) : entry.params[0].decodeFused(bad));
        }
        const output = callCompiled('mark_received', [input]);
        assert.equal(documents.stringifyCompiled(entry.result, output, {unwrapResult:true}), '{"received":true,"title":"hello","unknown":1e10000}');
        assert.throws(() => documents.parseCompiled(entry.params[0], '{"x":1,"x":2}'), /duplicate/);
        const failed = callCompiled('mark_received', [documents.parseCompiled(entry.params[0], 'null')]);
        assert.throws(() => documents.stringifyCompiled(entry.result, failed, {unwrapResult:true}), /result is Err/);
      }
      if (file === 'guide.md' && source.startsWith('module profiles;')) {
        const {functions, valueCodecs, callOwned, callBinary} = await import(pathToFileURL(modulePath).href);
        const profile = {name:'Ada', scores:[3,5], visits:2n};
        assert.deepEqual(functions.identity(profile), profile);
        const checked = valueCodecs.identity.arguments.capture({profile});
        assert.notEqual(checked.profile, profile);
        assert.notEqual(checked.profile.scores, profile.scores);
        const owned = callOwned('identity', [checked.profile]);
        assert.deepEqual(owned, profile);
        assert.notEqual(owned.scores, checked.profile.scores);
        const request = valueCodecs.identity.arguments.encode({profile});
        const received = valueCodecs.identity.result.decode(callBinary('identity', request));
        assert.deepEqual(received, profile);
        assert.throws(() => valueCodecs.identity.arguments.capture({profile:{...profile, visits:-1n}}));
        profile.scores[0] = 99;
        assert.equal(owned.scores[0], 3);
        assert.equal(received.scores[0], 3);
      }
      if (source.startsWith('module prices;')) {
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
