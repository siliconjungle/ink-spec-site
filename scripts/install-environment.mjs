import {readFile,writeFile,cp,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const [sourcePath,targetPath]=process.argv.slice(2);
if(!sourcePath||!targetPath)throw Error('Usage: node scripts/install-environment.mjs BUILT_APP DESTINATION');
const source=resolve(sourcePath),target=resolve(targetPath);
const info=JSON.parse(await readFile(`${source}/compiler-info.json`));
const expected=JSON.parse(await readFile(new URL('../content/environment.json',import.meta.url)));
const environment=JSON.parse(await readFile(`${source}/environment-info.json`));
if(environment.revision!==expected.revision||info.distribution!==expected.distribution)
  throw Error('Built editor or language revision differs from the documentation pins.');
const hash=createHash('sha256').update(await readFile(`${source}/ink-compiler.wasm`)).digest('hex');
if(info.sha256!==hash)throw Error('Browser compiler hash does not match its manifest.');
for(const name of ['index.html','environment-sw.js','runtime/assets.json'])await readFile(`${source}/${name}`);
await rm(`${target}/clang`,{recursive:true,force:true});
await mkdir(target,{recursive:true});await cp(source,target,{recursive:true});
await writeFile(`${target}/environment-info.json`,JSON.stringify(environment,null,2)+'\n');
console.log('Installed checked browser environment at '+target);
