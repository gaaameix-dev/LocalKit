import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// required files (now includes the extracted calculator and zip modules)
const required = ['index.html', 'package.json', 'vite.config.ts', 'src/main.tsx', 'src/styles.css', 'src/calc.ts', 'src/zip.ts'];
for (const f of required) if (!fs.existsSync(path.join(root, f))) throw new Error(`Missing ${f}`);

// every TypeScript source file in src/ is scanned, not just main.tsx
const srcDir = path.join(root, 'src');
const srcFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
if (srcFiles.length === 0) throw new Error('No source files found in src/');
const allSrc = srcFiles.map(f => ({ f, code: fs.readFileSync(path.join(srcDir, f), 'utf8') }));

const mainSrc = fs.readFileSync(path.join(root, 'src', 'main.tsx'), 'utf8');

// dangerous / forbidden APIs
const badPatterns = ['eval(', 'new Function(', 'XMLHttpRequest', 'WebSocket(', 'fetch(', 'document.write(', 'innerHTML', 'dangerouslySetInnerHTML'];
for (const { f, code } of allSrc) {
  for (const bad of badPatterns) {
    if (code.includes(bad)) throw new Error(`Forbidden API pattern in src/${f}: ${bad}`);
  }
}

// every advertised tool must be registered
const toolIds = ['pdf', 'vault', 'invoice', 'image', 'qr', 'dev', 'calc', 'compress', 'text', 'inspect'];
for (const id of toolIds) if (!mainSrc.includes(`id:'${id}'`)) throw new Error(`Missing tool: ${id}`);

// removed features must not come back, in any source file
const removedFeatures = ['Second Brain', 'LAN Drop', 'Screenshot Lab', 'function Share(', 'function Screen(', 'function Brain('];
for (const { f, code } of allSrc) {
  for (const removed of removedFeatures) {
    if (code.includes(removed)) throw new Error(`Removed feature still present in src/${f}: ${removed}`);
  }
}

// vault must use authenticated encryption with a fresh IV per record and PBKDF2 key derivation
if (!mainSrc.includes('AES-GCM')) throw new Error('Vault must use AES-GCM authenticated encryption');
if (!mainSrc.includes('PBKDF2')) throw new Error('Vault/PIN must use PBKDF2 key derivation');
if (!mainSrc.includes('getRandomValues(new Uint8Array(12))')) throw new Error('Vault must generate a fresh 12-byte IV per encryption');

// calculator must not use dynamic code execution (covered above) and must live in the audited src tree
if (!fs.readFileSync(path.join(root, 'src', 'calc.ts'), 'utf8').includes('export function evaluateExpression')) {
  throw new Error('Safe expression evaluator missing from src/calc.ts');
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.version !== '9.1.2') throw new Error('Version mismatch');
if (!pkg.scripts?.build || !pkg.scripts?.verify || !pkg.scripts?.test) throw new Error('Build/verify/test scripts missing');

console.log('LocalKit V9.1.2 verification: PASS');
