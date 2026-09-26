import fs from 'fs';
import path from 'path';
const root=process.cwd();
const files=['index.html','package.json','tsconfig.json','vite.config.ts','src/main.tsx','src/styles.css'];
for(const f of files){if(!fs.existsSync(path.join(root,f)))throw new Error(`Missing ${f}`)}
const src=fs.readFileSync(path.join(root,'src/main.tsx'),'utf8');
for(const bad of ['eval(', 'new Function(', 'fetch(', 'XMLHttpRequest', 'WebSocket(']) if(src.includes(bad)) throw new Error(`Disallowed network/code-execution API: ${bad}`);
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if(pkg.dependencies?.react!=='19.1.1') throw new Error('Dependencies are not pinned');
console.log('LocalKit offline verification: PASS');
console.log(`Checked ${files.length} required files and dangerous API patterns.`);
