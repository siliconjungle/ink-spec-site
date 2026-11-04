import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const compiler = process.argv[2];
if (!compiler) throw Error('Usage: node scripts/check-current.mjs /path/to/ink-lang/target/debug/ink');
const cli = resolve(compiler);
const language = dirname(dirname(dirname(cli)));
const directory = await mkdtemp(join(tmpdir(), 'ink-current-docs-'));
const ink = (...args) => {
  const result = spawnSync(cli, args, {encoding:'utf8', maxBuffer:16*1024*1024});
  if (result.status !== 0) throw Error(`ink ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
};
try {
  const choice = join(directory, 'learned-choice.ink');
  const task = join(directory, 'notifications.ink');
  for (const [file, target] of [['learned-choice.ink', choice], ['notifications.ink', task]]) {
    await writeFile(target, await readFile(new URL('../public/' + file, import.meta.url)));
    ink('check', target);
  }
  const data = join(directory, 'cases.json');
  await writeFile(data, '[]\n');
  const snapshot = join(directory, 'model.snapshot');
  ink('train', choice, '--objective', 'mistakes', '--data', data, '--seed', '7', '-o', snapshot);
  const rows = JSON.parse(ink('learn-rows', choice, '--restore', snapshot));
  assert.match(JSON.stringify(rows), /recover/);
  const model = join(directory, 'model');
  ink('build-model', choice, snapshot + '.trace.json', '--freeze-roots', '__learned', '--target', 'javascript', '-o', model);
  ink('verify-model', model, '--replay');
  const circuitPath = join(directory, 'decide.circuit.json');
  ink('emit-circuit', choice, 'decide', '--restore', snapshot, '-o', circuitPath);
  const {loadCircuit} = await import(pathToFileURL(join(language, 'runtime/hosts/circuit.mjs')));
  const circuit = loadCircuit(JSON.parse(await readFile(circuitPath, 'utf8')));
  // Training fills the missing false case; the authored true case stays true.
  assert.equal(circuit.call('false'), 'true');
  assert.equal(circuit.call('true'), 'true');

  const modulePath = join(directory, 'notifications.mjs');
  const tasksPath = join(directory, 'notifications.tasks.json');
  ink('build', task, '--target', 'javascript', '-o', modulePath);
  ink('emit-tasks', task, '-o', tasksPath);
  const {createState} = await import(pathToFileURL(modulePath));
  const {runTask, replayTask, stateCaller} = await import(pathToFileURL(join(language, 'runtime/hosts/tasks.mjs')));
  const manifest = JSON.parse(await readFile(tasksPath, 'utf8'));
  for (const [reply, expected] of [['short', 'short'], ['x'.repeat(141), 'Summary unavailable'], [42, 'Summary unavailable']]) {
    const sent = [];
    const {result, trace} = await runTask({manifest, call:stateCaller(await createState()), task:'send_summary', args:['a ticket'], effects:{
      summarise:async () => reply,
      notify:async message => {sent.push(message); return {Ok:null};},
    }});
    assert.deepEqual(result, {Ok:expected});
    assert.deepEqual(sent, [expected]);
    await replayTask({manifest, call:stateCaller(await createState()), trace});
    const tracePath = join(directory, 'task.trace.json');
    await writeFile(tracePath, JSON.stringify(trace));
    ink('replay-task', task, tracePath);
  }
  const mirPath = join(directory, 'notifications.mir.json');
  ink('emit-mir', task, '--simplify', '-o', mirPath);
  const mir = JSON.parse(await readFile(mirPath, 'utf8'));
  assert.equal(mir.format, 'ink-mir-v1');
  assert.equal(Object.keys(mir.unsupported || {}).length, 0);
  console.log('Checked current guide: train/freeze, exact finite circuit, accepted and fallback task replies, JavaScript/reference trace replay, and simplified MIR.');
} finally {
  await rm(directory, {recursive:true, force:true});
}
