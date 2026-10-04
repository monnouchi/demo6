import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const files=(await readdir(new URL('../src/',import.meta.url))).filter(name=>name.endsWith('.js'));
for(const file of files){const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../src/'+file,import.meta.url))],{stdio:'inherit'});if(result.status)process.exit(result.status);}
console.log(`${files.length} JavaScript modules: syntax OK`);
