# One-shot exact-match patch script for LocalKit V9.4.0
# (full Settings section + Stopwatch/Timer tool).
# Every patch asserts exactly one match; any mismatch aborts the run.

def patch(path, old, new, count=1):
    s = open(path, encoding='utf-8').read()
    assert s.count(old) == count, f"{path}: expected {count} match for {old[:60]!r}, got {s.count(old)}"
    open(path, 'w', encoding='utf-8').write(s.replace(old, new))

# --- src/main.tsx: localStorage keys ---

patch('src/main.tsx',
      "  pinVerifier: 'lk-v7-pin-verifier'\n};",
      "  pinVerifier: 'lk-v7-pin-verifier',\n  settings: 'lk-v7-settings',\n  lastTab: 'lk-v7-last-tab'\n};")

# --- src/main.tsx: settings model + accent engine (before app shell) ---

patch('src/main.tsx',
      "// ---------- app shell ----------",
      """// ---------- app settings ----------

type AppSettings = { accent: string; start: 'home' | 'last'; motion: boolean };
const DEFAULT_SETTINGS: AppSettings = { accent: 'violet', start: 'home', motion: true };
const ACCENTS: Record<string, { hex: string; strong: string; dim: string }> = {
  violet: { hex: '#8d7cff', strong: '#a99bff', dim: 'rgba(141,124,255,.14)' },
  blue: { hex: '#5aa2ff', strong: '#8cc0ff', dim: 'rgba(90,162,255,.14)' },
  green: { hex: '#38d39f', strong: '#7ee8c3', dim: 'rgba(56,211,159,.14)' },
  amber: { hex: '#ffc861', strong: '#ffdda1', dim: 'rgba(255,200,97,.14)' },
  pink: { hex: '#ff7bd5', strong: '#ffa9e4', dim: 'rgba(255,123,213,.14)' }
};
function applyAccent(name: string) {
  const a = ACCENTS[name] ?? ACCENTS.violet;
  const r = document.documentElement.style;
  r.setProperty('--accent', a.hex);
  r.setProperty('--accent-strong', a.strong);
  r.setProperty('--accent-dim', a.dim);
}

// ---------- app shell ----------""")

# --- src/main.tsx: tab state honours "last tool" startup preference ---

patch('src/main.tsx',
      "  const [tab, setTab] = useState('home');",
      """  const [tab, setTab] = useState(() => {
    const s = load(LS.settings, DEFAULT_SETTINGS);
    if (s.start === 'last') {
      const lt = load(LS.lastTab, 'home');
      if (lt === 'home' || lt === 'settings' || tools.some(t => t.id === lt)) return lt;
    }
    return 'home';
  });""")

# --- src/main.tsx: settings state + persistence in App ---

patch('src/main.tsx',
      "  useEffect(() => { save(LS.fav, fav); }, [fav]);",
      """  useEffect(() => { save(LS.fav, fav); }, [fav]);
  const [settings, setSettings] = useState<AppSettings>(() => load(LS.settings, DEFAULT_SETTINGS));
  useEffect(() => {
    applyAccent(settings.accent);
    document.documentElement.classList.toggle('no-anim', !settings.motion);
    save(LS.settings, settings);
  }, [settings]);
  useEffect(() => { save(LS.lastTab, tab); }, [tab]);""")

# --- src/main.tsx: naming — Privacy Center becomes Settings ---

patch('src/main.tsx',
      'onClick={() => setTab(\'settings\')}>⚙ Privacy</button>',
      'onClick={() => setTab(\'settings\')}>⚙ Settings</button>')
patch('src/main.tsx',
      "<h1>{tab === 'settings' ? 'Privacy Center' : active?.name || 'Your private toolkit'}</h1>",
      "<h1>{tab === 'settings' ? 'Settings' : active?.name || 'Your private toolkit'}</h1>")
patch('src/main.tsx', '<h2>Privacy Center</h2>', '<h2>Security — App Lock</h2>')
patch('src/main.tsx',
      '<span className="sheetName">Privacy</span>\n                <span className="sheetDesc">App lock and security settings</span>',
      '<span className="sheetName">Settings</span>\n                <span className="sheetDesc">Preferences, app lock and storage</span>')

# --- src/main.tsx: render the full settings page ---

patch('src/main.tsx',
      "              ? <Privacy pin={pin} setPin={onPinChange} setPrivacy={setPrivacy} disable={disable} />",
      "              ? <SettingsPage pin={pin} setPin={onPinChange} setPrivacy={setPrivacy} disable={disable} settings={settings} setSettings={setSettings} />")

# --- src/main.tsx: brand version ---

patch('src/main.tsx', '<div className="brand">✦ LocalKit <b>V9.2</b></div>', '<div className="brand">✦ LocalKit <b>V9.4</b></div>')

# --- src/main.tsx: registry + routing + stats + hero ---

patch('src/main.tsx',
      "  {id:'color',icon:'🎨',name:'Color Studio',desc:'HEX, RGB, HSL conversion and contrast check'}\n];",
      "  {id:'color',icon:'🎨',name:'Color Studio',desc:'HEX, RGB, HSL conversion and contrast check'},\n"
      "  {id:'stopwatch',icon:'⏱️',name:'Stopwatch',desc:'Precision stopwatch with laps and countdown timer'}\n];")
patch('src/main.tsx',
      "    case 'color': return <ColorStudio />;",
      "    case 'color': return <ColorStudio />;\n    case 'stopwatch': return <Watch />;")
patch('src/main.tsx', '<div><b>13</b><span>Tools</span></div>', '<div><b>14</b><span>Tools</span></div>')
patch('src/main.tsx',
      '<p>Documents, secrets, images, QR, code, files, colors, units and calculations in one offline workspace.</p>',
      '<p>Documents, secrets, images, QR, code, files, colors, units, timers and calculations in one offline workspace.</p>')

# --- src/main.tsx: SettingsPage component ---

patch('src/main.tsx',
      "// ---------- mobile bottom navigation + all-tools sheet ----------",
      """// ---------- settings page ----------

function SettingsPage(p: { pin: string; setPin: (s: string) => void; setPrivacy: () => void; disable: () => void; settings: AppSettings; setSettings: React.Dispatch<React.SetStateAction<AppSettings>> }) {
  const [usage, setUsage] = useState(0);
  const [entries, setEntries] = useState(0);
  useEffect(() => {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      total += k.length + (localStorage.getItem(k)?.length ?? 0);
    }
    setUsage(total);
    setEntries(localStorage.length);
  }, []);
  const set = (patchUpd: Partial<AppSettings>) => p.setSettings(s => ({ ...s, ...patchUpd }));
  return (
    <>
      <section className="panel">
        <div className="bigicon">⚙️</div>
        <h2>Settings</h2>
        <p>Preferences are saved on this device only and applied instantly.</p>
        <div className="prefRow">
          <div>
            <b>Accent color</b>
            <span className="prefDesc">Personalize the app highlight color</span>
          </div>
          <div className="swatches" role="radiogroup" aria-label="Accent color">
            {Object.entries(ACCENTS).map(([name, a]) => (
              <button key={name} role="radio" aria-checked={p.settings.accent === name} aria-label={name} title={name}
                className={p.settings.accent === name ? 'swatch on' : 'swatch'} style={{ background: a.hex }}
                onClick={() => set({ accent: name })}></button>
            ))}
          </div>
        </div>
        <div className="prefRow">
          <div>
            <b>Startup view</b>
            <span className="prefDesc">Open the dashboard or your last tool</span>
          </div>
          <div className="seg" role="radiogroup" aria-label="Startup view">
            <button className={p.settings.start === 'home' ? 'on' : ''} onClick={() => set({ start: 'home' })}>Home</button>
            <button className={p.settings.start === 'last' ? 'on' : ''} onClick={() => set({ start: 'last' })}>Last tool</button>
          </div>
        </div>
        <div className="prefRow">
          <div>
            <b>Animations</b>
            <span className="prefDesc">{p.settings.motion ? 'On — smooth transitions' : 'Off — reduced motion'}</span>
          </div>
          <button className={p.settings.motion ? 'toggle on' : 'toggle'} role="switch" aria-checked={p.settings.motion} aria-label="Animations"
            onClick={() => set({ motion: !p.settings.motion })}><span className="knob"></span></button>
        </div>
      </section>
      <Privacy pin={p.pin} setPin={p.setPin} setPrivacy={p.setPrivacy} disable={p.disable} />
      <section className="panel">
        <div className="bigicon">🧹</div>
        <h2>Storage</h2>
        <div className="storageMeter" role="img" aria-label="Local storage usage"><i style={{ width: Math.min(100, (usage / (5 * 1024 * 1024)) * 100) + '%' }}></i></div>
        <p className="muted">{entries} local entries · about {bytes(usage)} stored on this device (browser quota is typically 5 MB per origin).</p>
        <button className="danger" onClick={() => {
          if (confirm('Clear ALL local data — vault records, PIN, favorites and settings — from this browser? This cannot be undone.')) {
            localStorage.clear();
            location.reload();
          }
        }}>Clear all local data</button>
      </section>
      <section className="panel">
        <div className="bigicon">✦</div>
        <h2>About</h2>
        <div className="security">
          <b>LocalKit V9.4.0</b>
          <span>• 14 offline tools — no servers, no accounts, no tracking</span>
          <span>• Everything is processed on your device and stays on your device</span>
          <span>• Free and open source — installable as a PWA</span>
        </div>
      </section>
    </>
  );
}

// ---------- mobile bottom navigation + all-tools sheet ----------""")

# --- src/main.tsx: Stopwatch & Timer tool ---

patch('src/main.tsx',
      "// ---------- PDF Studio ----------",
      """// ---------- Stopwatch & Timer ----------

const sw = { start: 0, acc: 0, running: false, laps: [] as number[] };
const cd = { end: 0, running: false, done: false };

function fmt(ms: number): string {
  const t = Math.max(0, ms);
  const h = Math.floor(t / 3600000), m = Math.floor(t / 60000) % 60, s = Math.floor(t / 1000) % 60, cs = Math.floor((t % 1000) / 10);
  const p = (n: number) => String(n).padStart(2, '0');
  return (h > 0 ? h + ':' : '') + p(m) + ':' + p(s) + '.' + p(cs);
}
function elapsed(): number { return sw.acc + (sw.running ? performance.now() - sw.start : 0); }
function beep() {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctor();
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      const t0 = ctx.currentTime + i * 0.35;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.32);
    }
    setTimeout(() => ctx.close(), 1500);
  } catch { /* audio unavailable in this browser */ }
}

function Watch() {
  const [, force] = useState(0);
  const [h, setH] = useState('0');
  const [m, setM] = useState('5');
  const [s, setS] = useState('0');
  const toggleSw = () => {
    if (sw.running) { sw.acc += performance.now() - sw.start; sw.running = false; }
    else { sw.start = performance.now(); sw.running = true; }
  };
  const resetSw = () => { sw.acc = 0; sw.running = false; sw.laps = [];
 };
  const totalMs = ((+h || 0) * 3600 + (+m || 0) * 60 + (+s || 0)) * 1000;
  const startTimer = (ms: number) => { if (ms <= 0) return; cd.end = performance.now() + ms; cd.running = true; cd.done = false; };
  const cancelTimer = () => { cd.running = false; cd.done = false; };
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (cd.running && performance.now() >= cd.end) { cd.running = false; cd.done = true; beep(); }
      force(x => x + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); toggleSw(); }
      else if (e.key.toLowerCase() === 'l' && sw.running) sw.laps.push(elapsed());
      else if (e.key.toLowerCase() === 'r' && !sw.running) resetSw();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const remain = cd.running ? Math.max(0, cd.end - performance.now()) : 0;
  return (
    <Workspace icon="⏱️" title="Stopwatch" desc="High-precision stopwatch with laps and a countdown timer with an audio alarm. Timing uses the monotonic performance.now() clock and keeps running while you switch tools. Shortcuts: Space start/pause, L lap, R reset.">
      <div className="swDisplay" role="timer">{fmt(elapsed())}</div>
      <div className="actions">
        <button onClick={toggleSw}>{sw.running ? 'Pause' : sw.acc > 0 || sw.laps.length ? 'Resume' : 'Start'}</button>
        <button onClick={() => sw.laps.push(elapsed())} disabled={!sw.running}>Lap</button>
        <button onClick={resetSw} disabled={sw.running}>Reset</button>
      </div>
      {sw.laps.length > 0 && (
        <table className="lapTable">
          <thead><tr><th>Lap</th><th>Split</th><th>Total</th></tr></thead>
          <tbody>
            {(() => {
              const splits = sw.laps.map((l, j) => l - (sw.laps[j - 1] ?? 0));
              const minS = Math.min(...splits), maxS = Math.max(...splits);
              return sw.laps.map((lap, i) => (
                <tr key={i} className={splits.length > 1 ? (splits[i] === minS ? 'best' : splits[i] === maxS ? 'worst' : '') : ''}>
                  <td>{i + 1}</td><td>{fmt(splits[i])}</td><td>{fmt(lap)}</td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
      )}
      <h3 className="miniTitle">Countdown timer</h3>
      <div className="unitRow">
        <div><label>Hours</label><input inputMode="numeric" aria-label="Hours" value={h} onChange={e => setH(e.target.value.replace(/\\D/g, ''))} /></div>
        <div><label>Minutes</label><input inputMode="numeric" aria-label="Minutes" value={m} onChange={e => setM(e.target.value.replace(/\\D/g, ''))} /></div>
        <div><label>Seconds</label><input inputMode="numeric" aria-label="Seconds" value={s} onChange={e => setS(e.target.value.replace(/\\D/g, ''))} /></div>
      </div>
      <div className="presets">
        {[1, 3, 5, 10, 25].map(min => <button key={min} onClick={() => startTimer(min * 60000)}>{min} min</button>)}
      </div>
      <div className={'swDisplay' + (cd.done ? ' done' : '')}>{cd.running ? fmt(remain) : cd.done ? '00:00.00 ⏰' : fmt(totalMs)}</div>
      {cd.done && <p className="err" role="alert">Time is up!</p>}
      <div className="actions">
        <button onClick={() => startTimer(totalMs)} disabled={cd.running || totalMs <= 0}>Start timer</button>
        <button onClick={cancelTimer} disabled={!cd.running}>Cancel timer</button>
      </div>
    </Workspace>
  );
}

// ---------- PDF Studio ----------""")

# --- src/styles.css: settings + stopwatch styles ---

patch('src/styles.css',
      "/* ---------- responsive ---------- */",
      """/* ---------- settings + stopwatch ---------- */

.prefRow{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:14px 0;border-bottom:1px solid var(--border)}
.prefRow:last-child{border-bottom:none}
.prefRow b{display:block;font-size:15px}
.prefDesc{font-size:13px;color:var(--muted)}

.swatches{display:flex;gap:10px}
.swatch{width:32px;height:32px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:transform .2s var(--spring),border-color .2s}
.swatch:hover{transform:scale(1.12)}
.swatch.on{border-color:#fff;box-shadow:0 0 0 3px var(--accent-dim)}

.seg{display:flex;background:var(--surface-3);border-radius:12px;padding:4px;gap:4px}
.seg button{padding:8px 14px;border-radius:9px;font-size:13px;background:transparent;border:none;color:var(--muted);cursor:pointer;transition:background .2s,color .2s}
.seg button.on{background:var(--accent-dim);color:var(--text)}

.toggle{width:52px;height:30px;border-radius:999px;border:1px solid var(--border-strong);background:var(--surface-3);position:relative;cursor:pointer;transition:background .25s,border-color .25s;padding:0}
.toggle .knob{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:var(--muted);transition:transform .25s var(--spring),background .25s}
.toggle.on{background:var(--accent-dim);border-color:var(--accent)}
.toggle.on .knob{transform:translateX(22px);background:var(--accent-strong)}

.storageMeter{height:8px;border-radius:6px;background:var(--surface-3);overflow:hidden;margin:10px 0}
.storageMeter i{display:block;height:100%;border-radius:6px;background:var(--accent);transition:width .4s var(--ease)}

.swDisplay{
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:clamp(40px,9vw,60px);font-weight:700;text-align:center;letter-spacing:2px;
  margin:10px 0;padding:18px;border-radius:18px;
  background:rgba(141,124,255,.06);border:1px dashed var(--border-strong);word-break:break-all;
}
.swDisplay.done{color:var(--err);border-color:#633744}
.miniTitle{margin:22px 0 4px;font-size:15px}
.lapTable{width:100%;border-collapse:collapse;margin-top:10px;font-size:14px}
.lapTable td,.lapTable th{padding:8px 10px;text-align:right;border-bottom:1px solid var(--border)}
.lapTable th{color:var(--muted);font-weight:600}
.lapTable td:first-child,.lapTable th:first-child{text-align:left}
.lapTable tr.best td{color:#5ade80}
.lapTable tr.worst td{color:var(--err)}
.presets{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}

html.no-anim *,html.no-anim *::before,html.no-anim *::after{animation-duration:.01ms !important;transition-duration:.01ms !important}

/* ---------- responsive ---------- */""")

# --- package.json ---

patch('package.json', '"version": "9.3.0"', '"version": "9.4.0"')

# --- scripts/verify.mjs ---

patch('scripts/verify.mjs',
      "const toolIds = ['pdf', 'vault', 'invoice', 'image', 'qr', 'dev', 'calc', 'compress', 'text', 'inspect', 'pw', 'units', 'color'];",
      "const toolIds = ['pdf', 'vault', 'invoice', 'image', 'qr', 'dev', 'calc', 'compress', 'text', 'inspect', 'pw', 'units', 'color', 'stopwatch'];")
patch('scripts/verify.mjs', "if (pkg.version !== '9.3.0')", "if (pkg.version !== '9.4.0')")
patch('scripts/verify.mjs', "console.log('LocalKit V9.3.0 verification: PASS');", "console.log('LocalKit V9.4.0 verification: PASS');")

# --- README.md ---

patch('README.md', '# LocalKit V9.3.0 — Stable Privacy Edition', '# LocalKit V9.4.0 — Stable Privacy Edition')
patch('README.md', '## 13 shipped tools', '## 14 shipped tools')
patch('README.md', '13. Color Studio',
      '13. Color Studio\n14. Stopwatch & Timer')
patch('README.md',
      'V9.3.0 release: three new offline tools',
      'V9.4.0 release: full Settings section (accent color, startup view, animation toggle,\nstorage manager with one-tap local data wipe, about panel) and a new Stopwatch tool\n(precision stopwatch with laps, best/worst highlighting, countdown timer with presets\nand an audio alarm, keyboard shortcuts). V9.3.0 release: three new offline tools')

# --- BUILD-VERIFICATION.md ---

patch('BUILD-VERIFICATION.md', '# LocalKit build verification (V9.3.0)', '# LocalKit build verification (V9.4.0)')
patch('BUILD-VERIFICATION.md', '- package version pinned to 9.3.0', '- package version pinned to 9.4.0')
patch('BUILD-VERIFICATION.md', '## V9.3.0 new tools',
      '''## V9.4.0 settings + stopwatch

The Privacy Center grew into a full Settings page: accent color selection (five palettes
applied live through CSS custom properties), startup view preference (dashboard or last
used tool), an animations toggle for reduced motion, a storage manager showing local
storage usage with a confirmed clear-all-data action, and an About panel. A new
Stopwatch tool uses the monotonic performance.now() clock with lap tracking, best/worst
lap highlighting, a countdown timer with quick presets and a Web Audio alarm; state is
kept at module level so timing survives switching tools. All offline, zero new
dependencies; no existing tool logic or privacy model changed.

## V9.3.0 new tools''')

print('V9.4.0 patches applied successfully')
