# One-shot exact-match patch script for LocalKit V9.3.0 (three new offline tools).
# Every patch asserts exactly one match; any mismatch aborts the run.

def patch(path, old, new, count=1):
    s = open(path, encoding='utf-8').read()
    assert s.count(old) == count, f"{path}: expected {count} match for {old[:60]!r}, got {s.count(old)}"
    open(path, 'w', encoding='utf-8').write(s.replace(old, new))

# --- src/main.tsx: tool registry ---

patch('src/main.tsx',
      "  {id:'inspect',icon:'🔎',name:'File Inspector',desc:'File metadata, SHA-256 and duplicate checks'}\n];",
      "  {id:'inspect',icon:'🔎',name:'File Inspector',desc:'File metadata, SHA-256 and duplicate checks'},\n"
      "  {id:'pw',icon:'🔑',name:'PassGen',desc:'Crypto-secure passwords with strength estimate'},\n"
      "  {id:'units',icon:'📏',name:'Unit Convert',desc:'Length, weight, temperature, data and more'},\n"
      "  {id:'color',icon:'🎨',name:'Color Studio',desc:'HEX, RGB, HSL conversion and contrast check'}\n];")

# --- src/main.tsx: routing ---

patch('src/main.tsx',
      "    case 'inspect': return <Inspector />;\n    default: return null;",
      "    case 'inspect': return <Inspector />;\n    case 'pw': return <PassGen />;\n    case 'units': return <Units />;\n    case 'color': return <ColorStudio />;\n    default: return null;")

# --- src/main.tsx: home stats + hero copy ---

patch('src/main.tsx', '<div><b>10</b><span>Tools</span></div>', '<div><b>13</b><span>Tools</span></div>')
patch('src/main.tsx',
      '<p>Documents, secrets, images, QR, code, files and calculations in one offline workspace.</p>',
      '<p>Documents, secrets, images, QR, code, files, colors, units and calculations in one offline workspace.</p>')

# --- src/main.tsx: new tool components ---

patch('src/main.tsx',
      "// ---------- PDF Studio ----------",
      """// ---------- Password Generator ----------

function PassGen() {
  const [len, setLen] = useState(16);
  const [opts, setOpts] = useState({ upper: true, lower: true, nums: true, syms: true });
  const [exclude, setExclude] = useState('Il1O0');
  const [pw, setPw] = useState('');
  const [copied, setCopied] = useState(false);
  const pool = useMemo(() => {
    let p = '';
    if (opts.upper) p += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (opts.lower) p += 'abcdefghijklmnopqrstuvwxyz';
    if (opts.nums) p += '0123456789';
    if (opts.syms) p += '!@#$%^&*()-_=+[]{};:,.?';
    return [...p].filter(c => !exclude.includes(c)).join('');
  }, [opts, exclude]);
  const gen = () => {
    if (!pool) { setPw(''); return; }
    const rand = crypto.getRandomValues(new Uint32Array(len));
    let out = '';
    for (let i = 0; i < len; i++) out += pool[rand[i] % pool.length];
    setPw(out);
    setCopied(false);
  };
  useEffect(() => { gen(); }, []);
  const bits = pw ? Math.round(pw.length * Math.log2(Math.max(2, pool.length))) : 0;
  const strength = bits >= 100 ? { label: 'Excellent', pct: 100, color: '#5ade80' }
    : bits >= 72 ? { label: 'Strong', pct: 75, color: '#8fe38f' }
    : bits >= 48 ? { label: 'Fair', pct: 50, color: '#ffd166' }
    : { label: 'Weak', pct: 25, color: '#ff9b9b' };
  return (
    <Workspace icon="🔑" title="PassGen" desc="Cryptographically secure passwords generated locally with crypto.getRandomValues. Nothing is stored or transmitted.">
      <div className="checkRow">
        <label><input type="checkbox" checked={opts.upper} onChange={e => setOpts(o => ({ ...o, upper: e.target.checked }))} /> A–Z</label>
        <label><input type="checkbox" checked={opts.lower} onChange={e => setOpts(o => ({ ...o, lower: e.target.checked }))} /> a–z</label>
        <label><input type="checkbox" checked={opts.nums} onChange={e => setOpts(o => ({ ...o, nums: e.target.checked }))} /> 0–9</label>
        <label><input type="checkbox" checked={opts.syms} onChange={e => setOpts(o => ({ ...o, syms: e.target.checked }))} /> Symbols</label>
      </div>
      <label>Length: {len}</label>
      <input type="range" min={8} max={64} value={len} onChange={e => setLen(+e.target.value)} aria-label="Password length" />
      <label>Exclude characters</label>
      <input aria-label="Characters to exclude" value={exclude} onChange={e => setExclude(e.target.value)} placeholder="e.g. Il1O0" />
      <div className="actions">
        <button onClick={gen}>Generate password</button>
        {pw && <button onClick={() => { navigator.clipboard?.writeText(pw); setCopied(true); }}>{copied ? '✓ Copied' : 'Copy'}</button>}
      </div>
      {pw && <div className="pwOut"><span className="pwText">{pw}</span></div>}
      {pw && (
        <>
          <div className="strength" role="img" aria-label={`Strength: ${strength.label}`}><i style={{ width: strength.pct + '%', background: strength.color }}></i></div>
          <p className="muted">~{bits} bits of entropy — {strength.label}</p>
        </>
      )}
      {!pool && <p className="err" role="alert">Select at least one character set (after exclusions).</p>}
    </Workspace>
  );
}

// ---------- Unit Converter ----------

const UNIT_CATS: Record<string, Record<string, number>> = {
  Length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, inch: 0.0254, foot: 0.3048, yard: 0.9144, mile: 1609.344 },
  Weight: { mg: 1e-6, gram: 0.001, kg: 1, tonne: 1000, ounce: 0.0283495, pound: 0.453592 },
  Data: { Byte: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 },
  Speed: { 'm/s': 1, 'km/h': 0.277778, mph: 0.44704, knot: 0.514444 },
  Area: { 'sq m': 1, 'sq km': 1e6, 'sq ft': 0.092903, acre: 4046.856, hectare: 10000 }
};
const TEMPS = ['°C', '°F', 'K'];

function tempToC(v: number, from: string): number {
  return from === '°C' ? v : from === '°F' ? (v - 32) * 5 / 9 : v - 273.15;
}
function tempFromC(c: number, to: string): number {
  return to === '°C' ? c : to === '°F' ? c * 9 / 5 + 32 : c + 273.15;
}

function Units() {
  const [cat, setCat] = useState('Length');
  const [val, setVal] = useState('1');
  const [from, setFrom] = useState('m');
  const [to, setTo] = useState('foot');
  const units = cat === 'Temperature' ? TEMPS : Object.keys(UNIT_CATS[cat]);
  const n = Number(val);
  const okNum = val.trim() !== '' && Number.isFinite(n);
  let result = '';
  if (okNum) {
    if (cat === 'Temperature') result = String(tempFromC(tempToC(n, from), to));
    else result = String(n * UNIT_CATS[cat][from] / UNIT_CATS[cat][to]);
  }
  const switchCat = (c: string) => {
    setCat(c);
    const us = c === 'Temperature' ? TEMPS : Object.keys(UNIT_CATS[c]);
    setFrom(us[0]);
    setTo(us[1]);
  };
  return (
    <Workspace icon="📏" title="Unit Convert" desc="Everyday unit conversions — length, weight, temperature, data, speed and area. Runs entirely offline.">
      <label>Category</label>
      <select aria-label="Category" value={cat} onChange={e => switchCat(e.target.value)}>
        {['Length', 'Weight', 'Temperature', 'Data', 'Speed', 'Area'].map(c => <option key={c}>{c}</option>)}
      </select>
      <div className="unitRow">
        <div>
          <label>From</label>
          <select aria-label="Convert from" value={from} onChange={e => setFrom(e.target.value)}>{units.map(u => <option key={u}>{u}</option>)}</select>
        </div>
        <button className="unitSwap" aria-label="Swap units" title="Swap" onClick={() => { setFrom(to); setTo(from); }}>⇄</button>
        <div>
          <label>To</label>
          <select aria-label="Convert to" value={to} onChange={e => setTo(e.target.value)}>{units.map(u => <option key={u}>{u}</option>)}</select>
        </div>
      </div>
      <label>Value</label>
      <input aria-label="Value to convert" value={val} onChange={e => setVal(e.target.value)} placeholder="Enter a number" inputMode="decimal" />
      <p className="unitResult">{okNum ? `${val} ${from} = ${result} ${to}` : <span className="err">Enter a valid number.</span>}</p>
    </Workspace>
  );
}

// ---------- Color Studio ----------

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}
function luminance(r: number, g: number, b: number): number {
  const f = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ColorStudio() {
  const [hex, setHex] = useState('#8d7cff');
  const rgb = hexToRgb(hex);
  const [r, g, b] = rgb ?? [141, 124, 255];
  const [h, s, l] = rgb ? rgbToHsl(r, g, b) : [0, 0, 0];
  const lum = luminance(r, g, b);
  const cWhite = 1.05 / (lum + 0.05);
  const cBlack = (lum + 0.05) / 0.05;
  const copy = (t: string) => navigator.clipboard?.writeText(t);
  return (
    <Workspace icon="🎨" title="Color Studio" desc="HEX, RGB and HSL conversion with WCAG contrast checking — all local.">
      <div className="colorRow">
        <input type="color" aria-label="Pick a color" value={rgb ? hex : '#8d7cff'} onChange={e => setHex(e.target.value)} />
        <input className="colorCode" style={{ width: 130 }} aria-label="Hex color code" value={hex} onChange={e => setHex(e.target.value)} placeholder="#8d7cff" />
      </div>
      <div className="colorSwatch" style={{ background: hex }} aria-hidden="true"></div>
      {rgb ? (
        <>
          <div className="colorRow">
            <button className="colorCode" onClick={() => copy(hex.toUpperCase())}>HEX {hex.toUpperCase()}</button>
            <button className="colorCode" onClick={() => copy(`rgb(${r}, ${g}, ${b})`)}>{`rgb(${r}, ${g}, ${b})`}</button>
            <button className="colorCode" onClick={() => copy(`hsl(${h}, ${s}%, ${l}%)`)}>{`hsl(${h}, ${s}%, ${l}%)`}</button>
          </div>
          <div className="security" style={{ marginTop: 14 }}>
            <b>WCAG contrast</b>
            <span>vs black: {cBlack.toFixed(1)}:1 — {cBlack >= 7 ? 'AAA' : cBlack >= 4.5 ? 'AA' : 'fail'}</span>
            <span>vs white: {cWhite.toFixed(1)}:1 — {cWhite >= 7 ? 'AAA' : cWhite >= 4.5 ? 'AA' : 'fail'}</span>
          </div>
        </>
      ) : <p className="err" role="alert">Enter a valid 6-digit hex color like #8d7cff.</p>}
    </Workspace>
  );
}

// ---------- PDF Studio ----------""")

# --- src/styles.css: styles for the new tools ---

patch('src/styles.css',
      "/* ---------- responsive ---------- */",
      """/* ---------- password / units / color tools ---------- */

.checkRow{display:flex;flex-wrap:wrap;gap:14px;margin:10px 0 14px}
.checkRow label{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--muted);cursor:pointer}
.checkRow input{width:16px;height:16px;accent-color:var(--accent);cursor:pointer;margin:0}

.pwOut{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  border:1px dashed var(--border-strong);border-radius:16px;background:rgba(141,124,255,.06);
  padding:16px;margin:6px 0 10px;min-height:56px;
}
.pwText{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:17px;word-break:break-all;flex:1;min-width:200px}
.strength{height:6px;border-radius:6px;background:var(--surface-3);overflow:hidden;margin:4px 0 2px}
.strength i{display:block;height:100%;border-radius:6px;transition:width .3s var(--ease),background .3s}

.unitRow{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:end}
.unitSwap{
  width:44px;height:44px;border-radius:50%;border:1px solid var(--border-strong);
  background:var(--surface-2);font-size:16px;
  transition:transform .3s var(--spring),background .18s;
}
.unitSwap:hover{background:var(--surface-3)}
.unitSwap:active{transform:rotate(180deg)}
.unitResult{font-size:22px;font-weight:700;margin-top:14px;word-break:break-all}

.colorSwatch{height:90px;border-radius:18px;border:1px solid var(--border-strong);margin:12px 0}
.colorRow{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.colorRow input[type='color']{
  width:56px;height:44px;padding:4px;cursor:pointer;background:var(--surface-2);
  border:1px solid var(--border-strong);border-radius:12px;
}
.colorCode{
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;
  background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:9px 12px;
}

@media (max-width:900px){
  .unitRow{grid-template-columns:1fr;justify-items:stretch}
}

/* ---------- responsive ---------- */""")

# --- package.json ---

patch('package.json', '"version": "9.2.0"', '"version": "9.3.0"')

# --- scripts/verify.mjs ---

patch('scripts/verify.mjs',
      "const toolIds = ['pdf', 'vault', 'invoice', 'image', 'qr', 'dev', 'calc', 'compress', 'text', 'inspect'];",
      "const toolIds = ['pdf', 'vault', 'invoice', 'image', 'qr', 'dev', 'calc', 'compress', 'text', 'inspect', 'pw', 'units', 'color'];")
patch('scripts/verify.mjs', "if (pkg.version !== '9.2.0')", "if (pkg.version !== '9.3.0')")
patch('scripts/verify.mjs', "console.log('LocalKit V9.2.0 verification: PASS');", "console.log('LocalKit V9.3.0 verification: PASS');")

# --- README.md ---

patch('README.md', '# LocalKit V9.2.0 — Stable Privacy Edition', '# LocalKit V9.3.0 — Stable Privacy Edition')
patch('README.md', '## 10 shipped tools', '## 13 shipped tools')
patch('README.md', '10. File Inspector',
      '10. File Inspector\n11. PassGen (password generator)\n12. Unit Convert\n13. Color Studio')
patch('README.md',
      'V9.2.0 release: premium app-style UI refresh',
      'V9.3.0 release: three new offline tools — PassGen (crypto-secure password generator with\nentropy estimate), Unit Convert (length, weight, temperature, data, speed, area) and Color\nStudio (HEX/RGB/HSL conversion with WCAG contrast checking). V9.2.0 release: premium app-style UI refresh')

# --- BUILD-VERIFICATION.md ---

patch('BUILD-VERIFICATION.md', '# LocalKit build verification (V9.2.0)', '# LocalKit build verification (V9.3.0)')
patch('BUILD-VERIFICATION.md', '- package version pinned to 9.2.0', '- package version pinned to 9.3.0')
patch('BUILD-VERIFICATION.md', '## V9.2.0 UI refresh',
      '''## V9.3.0 new tools

Three new tools added, all fully offline with zero new dependencies: PassGen (password
generator using crypto.getRandomValues with a live entropy/strength estimate), Unit
Convert (length, weight, temperature, data, speed and area categories with unit swap) and
Color Studio (HEX/RGB/HSL conversion with WCAG AA/AAA contrast checking). The tool registry,
home stats and the verify.mjs tool-id list were extended accordingly. No existing tool
logic, the privacy model or the verification rules were changed.

## V9.2.0 UI refresh''')

print('V9.3.0 patches applied successfully')
