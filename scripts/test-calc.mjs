// Unit tests for the calculator engine and ZIP writer.
// Compiles src/calc.ts and src/zip.ts using the dedicated test config
// (tsconfig.test.json) with the project's installed TypeScript compiler, then
// imports the emitted JavaScript and runs assertions.
//
// tsconfig.test.json sets "types": [] so compilation does NOT auto-discover
// every package under node_modules/@types — the old file-list invocation
// (`npx tsc src/calc.ts ...`) triggered ambient @types discovery and failed
// with TS2688 in environments where transitive @types stubs are broken.
// The test sources have no ambient type dependencies, so disabling discovery
// removes that failure mode without weakening any check: strict mode,
// noUnusedLocals and noUnusedParameters all remain enabled.
// src/zip.ts is compiled because this suite also tests the ZIP writer used by
// PDF page extraction.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = process.cwd();
const outDir = path.join(root, '.test-build');

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`  ok - ${name}`);
  } else {
    failures++;
    console.error(`  FAIL - ${name}${detail !== undefined ? ` (got: ${JSON.stringify(detail)})` : ''}`);
  }
}

execSync('npx tsc -p tsconfig.test.json', { stdio: 'inherit' });

const calcPath = path.join(outDir, 'calc.js');
const zipPath = path.join(outDir, 'zip.js');
if (!fs.existsSync(calcPath) || !fs.existsSync(zipPath)) {
  console.error('Test compilation did not produce calc.js/zip.js — aborting.');
  process.exit(1);
}

const { evaluateExpression, gstCalc, discountCalc, emiCalc } = await import(url.pathToFileURL(calcPath).href);
const { createZip, crc32 } = await import(url.pathToFileURL(zipPath).href);

// --- expression evaluator ---
console.log('Calculator expression tests:');
const exprCases = [
  ['2 + 3', 5],
  ['2 * 3', 6],
  ['10 / 2', 5],
  ['2 + 3 * 4', 14],
  ['(2 + 3) * 4', 20],
  ['10 - 3 - 2', 5],
  ['2 * 3 + 4 * 5', 26],
  ['100 % 7', 2],
  ['(1 + 2) * (3 + 4)', 21],
  ['3.5 + 1.25', 4.75],
];
for (const [expr, expected] of exprCases) {
  const r = evaluateExpression(expr);
  check(`${expr} = ${expected}`, r.ok && Math.abs(r.value - expected) < 1e-9, r);
}
{
  const r = evaluateExpression('0.1 + 0.2');
  check('0.1 + 0.2 ≈ 0.3', r.ok && Math.abs(r.value - 0.3) < 1e-9, r);
}
{
  const r = evaluateExpression('-5 + 3');
  check('unary minus: -5 + 3 = -2', r.ok && Math.abs(r.value + 2) < 1e-9, r);
}
{
  const r = evaluateExpression('2 * -3');
  check('unary minus: 2 * -3 = -6', r.ok && Math.abs(r.value + 6) < 1e-9, r);
}
{
  const r = evaluateExpression('-(2 + 3)');
  check('unary minus: -(2 + 3) = -5', r.ok && Math.abs(r.value + 5) < 1e-9, r);
}
{
  const r = evaluateExpression('5 / 0');
  check('division by zero is a friendly error', !r.ok && /zero/i.test(r.error), r);
}
{
  const r = evaluateExpression('5 % 0');
  check('modulo by zero is a friendly error', !r.ok && /zero/i.test(r.error), r);
}
for (const bad of ['2 +', '* 3', '(2 + 3', '2 + 3)', 'abc', '2 3', '()', '', '2 & 3', '2..5 + 1']) {
  const r = evaluateExpression(bad);
  check(`invalid expression ${JSON.stringify(bad)} rejected`, !r.ok && r.error.length > 0, r);
}

// --- dedicated calculations ---
console.log('Dedicated calculation tests:');
{
  const g = gstCalc('1000', '18');
  check('GST 1000 @ 18% = 180, total 1180', !('error' in g) && Math.abs(g.gst - 180) < 1e-9 && Math.abs(g.total - 1180) < 1e-9, g);
  check('GST rejects invalid input', 'error' in gstCalc('abc', '18'));
}
{
  const d = discountCalc('1000', '10');
  check('Discount 1000 @ 10% = 100 off, final 900', !('error' in d) && Math.abs(d.discount - 100) < 1e-9 && Math.abs(d.final - 900) < 1e-9, d);
  check('Discount rejects invalid input', 'error' in discountCalc('-5', '10'));
}
{
  const e = emiCalc('100000', '12', '12');
  // EMI for 1,00,000 at 12% p.a. for 12 months
  const expected = 8884.88;
  check('EMI 100000 @ 12% for 12 months ≈ 8884.88', !('error' in e) && Math.abs(e.emi - expected) < 0.01, e);
  check('EMI zero-interest: 1200 for 12 months = 100/month', !( 'error' in emiCalc('1200', '0', '12')) && Math.abs(emiCalc('1200', '0', '12').emi - 100) < 1e-9);
  check('EMI rejects zero months', 'error' in emiCalc('1000', '10', '0'));
}

// --- zip writer ---
console.log('ZIP writer tests:');
{
  const enc = new TextEncoder();
  const blob = createZip([{ name: 'a.txt', data: enc.encode('hello') }, { name: 'b/page.txt', data: enc.encode('world') }]);
  const buf = new Uint8Array(await blob.arrayBuffer());
  check('ZIP local header signature', buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04, [...buf.slice(0, 4)]);
  const eocd = buf.slice(buf.length - 22);
  check('ZIP end-of-central-directory signature', eocd[0] === 0x50 && eocd[1] === 0x4b && eocd[2] === 0x05 && eocd[3] === 0x06, [...eocd.slice(0, 4)]);
  check('ZIP contains 2 entries', eocd[10] === 2 && eocd[8] === 2, [eocd[8], eocd[10]]);
  const text = new TextDecoder().decode(buf);
  check('ZIP contains both file names', text.includes('a.txt') && text.includes('b/page.txt'));
  check('crc32("hello") matches known value', crc32(enc.encode('hello')) === 0x3610a686, crc32(enc.encode('hello')));
  // structural layout: local sections must all come before the first central
  // directory record, and the EOCD offset must point exactly at the first CD entry
  const localSig = (i) => buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x03 && buf[i + 3] === 0x04;
  const cdSig = (i) => buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x01 && buf[i + 3] === 0x02;
  let firstCd = -1;
  for (let i = 0; i < buf.length - 4; i++) if (cdSig(i)) { firstCd = i; break; }
  check('central directory exists', firstCd > 0);
  let noLocalAfterCd = true;
  for (let i = firstCd + 4; i < buf.length - 4; i++) if (localSig(i)) noLocalAfterCd = false;
  check('no local headers after central directory', noLocalAfterCd);
  const cdOffset = eocd[16] | (eocd[17] << 8) | (eocd[18] << 16) | (eocd[19] << 24);
  check('EOCD central directory offset is exact', cdOffset === firstCd, { cdOffset, firstCd });
}

fs.rmSync(outDir, { recursive: true, force: true });

if (failures > 0) {
  console.error(`${failures} test(s) FAILED`);
  process.exit(1);
}
console.log('All calculator and zip tests: PASS');
