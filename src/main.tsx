import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { evaluateExpression, gstCalc, discountCalc, emiCalc } from './calc';
import { createZip } from './zip';
import './styles.css';

type Tool = { id: string; icon: string; name: string; desc: string };
const tools: Tool[] = [
  {id:'pdf',icon:'📄',name:'PDF Studio',desc:'Merge, extract and download PDFs'},
  {id:'vault',icon:'🔐',name:'Privacy Vault',desc:'Encrypted local secrets with app lock'},
  {id:'invoice',icon:'🧾',name:'Invoice Pro',desc:'GST invoice with line items and PDF export'},
  {id:'image',icon:'🖼️',name:'Image Lab',desc:'Resize and compress images locally'},
  {id:'qr',icon:'🧩',name:'QR Studio',desc:'Generate downloadable QR codes'},
  {id:'dev',icon:'🛠️',name:'Dev Forge',desc:'JSON, Base64, URL, UUID and SHA-256'},
  {id:'calc',icon:'🧮',name:'Calculator',desc:'Safe math, GST, discount and EMI'},
  {id:'compress',icon:'🗜️',name:'GZIP Compressor',desc:'Compress files locally with GZIP'},
  {id:'text',icon:'📝',name:'Text Studio',desc:'Markdown preview, word count and case tools'},
  {id:'inspect',icon:'🔎',name:'File Inspector',desc:'File metadata, SHA-256 and duplicate checks'},
  {id:'pw',icon:'🔑',name:'PassGen',desc:'Crypto-secure passwords with strength estimate'},
  {id:'units',icon:'📏',name:'Unit Convert',desc:'Length, weight, temperature, data and more'},
  {id:'color',icon:'🎨',name:'Color Studio',desc:'HEX, RGB, HSL conversion and contrast check'}
];

const LS = {
  fav: 'lk-v7-fav',
  pin: 'lk-v7-pin',
  pinSalt: 'lk-v7-pin-salt',
  pinVerifier: 'lk-v7-pin-verifier'
};

// ---------- shared helpers ----------

function b64bytes(b: Uint8Array): string {
  // chunked conversion: spreading a huge array into String.fromCharCode can
  // overflow the call stack
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < b.length; i += CH) s += String.fromCharCode(...b.subarray(i, i + CH));
  return btoa(s);
}
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function load<T>(k: string, d: T): T {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d;
  } catch {
    return d; // corrupted stored JSON falls back to the default
  }
}
/** Persist to localStorage; returns false when the write failed (e.g. quota). */
function save(k: string, v: unknown): boolean {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}
function bytes(n: number): string {
  return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
}
async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // revoke late enough that even large downloads have started
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
/** pdf-lib standard fonts use WinAnsi encoding; sanitize text before drawText. */
function pdfSafe(s: string): string {
  const replaced = s
    .replace(/₹/g, 'Rs.')
    .replace(/[→←]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/…/g, '...')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
  let out = '';
  for (const ch of replaced) out += ch.charCodeAt(0) <= 255 ? ch : '?';
  return out;
}

async function pinVerifier(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256'}, base, 256);
  return b64bytes(new Uint8Array(bits));
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'}>;
};
function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPromptEvent); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', on);
    window.addEventListener('appinstalled', done);
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone));
    return () => {
      window.removeEventListener('beforeinstallprompt', on);
      window.removeEventListener('appinstalled', done);
    };
  }, []);
  if (installed) return <span className="installState">✓ Installed</span>;
  if (!prompt)
    return <button className="installBtn" aria-label="Install app" onClick={() => alert('Chrome/Edge me browser menu kholkar “Install app” ya “Add to Home screen” choose karein. LocalKit koi data server par upload nahi karta.')}>📲 Install App</button>;
  return <button className="installBtn" aria-label="Install app" onClick={async () => { await prompt.prompt(); const r = await prompt.userChoice; if (r.outcome === 'accepted') setInstalled(true); setPrompt(null); }}>📲 Install App</button>;
}

// ---------- app shell ----------

function App() {
  const [fav, setFav] = useState<string[]>(() => load(LS.fav, []));
  const [tab, setTab] = useState('home');
  const [q, setQ] = useState('');
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [locked, setLocked] = useState(() => !!(localStorage.getItem(LS.pinVerifier) || localStorage.getItem(LS.pin)));
  useEffect(() => { save(LS.fav, fav); }, [fav]);
  const visible = useMemo(() => tools.filter(t => (t.name + t.desc).toLowerCase().includes(q.toLowerCase())), [q]);

  const onPinChange = (v: string) => { setPin(v); setPinErr(''); };
  const unlock = async () => {
    if (pin.length !== 6) { if (pin.length > 0) setPinErr('Enter all 6 digits of your PIN.'); return; }
    try {
      const saltRaw = localStorage.getItem(LS.pinSalt);
      const ver = localStorage.getItem(LS.pinVerifier);
      const legacy = localStorage.getItem(LS.pin);
      if (saltRaw && ver) {
        const ok = (await pinVerifier(pin, fromB64(saltRaw))) === ver;
        if (ok) { setLocked(false); setPin(''); }
        else setPinErr('Incorrect PIN — try again.');
        return;
      }
      if (legacy && btoa(pin) === legacy) {
        // migrate legacy plaintext-encoded PIN to a salted PBKDF2 verifier
        const salt = crypto.getRandomValues(new Uint8Array(16));
        localStorage.setItem(LS.pinSalt, b64bytes(salt));
        localStorage.setItem(LS.pinVerifier, await pinVerifier(pin, salt));
        localStorage.removeItem(LS.pin);
        setLocked(false);
        setPin('');
        return;
      }
      if (ver) { setPinErr('Stored PIN data is corrupted. Clear this site’s data to reset the app lock.'); return; }
      setPinErr('Incorrect PIN — try again.');
    } catch {
      setPinErr('Unlock failed — Web Crypto may be unavailable in this browser.');
    }
  };
  const setPrivacy = async () => {
    if (pin.length !== 6) return;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(LS.pinSalt, b64bytes(salt));
    localStorage.setItem(LS.pinVerifier, await pinVerifier(pin, salt));
    localStorage.removeItem(LS.pin); // legacy plaintext-encoded PIN, if any
    setLocked(true);
    setPin('');
  };
  const disable = () => {
    localStorage.removeItem(LS.pin);
    localStorage.removeItem(LS.pinSalt);
    localStorage.removeItem(LS.pinVerifier);
    setLocked(false);
  };

  if (locked) return <Lock pin={pin} setPin={onPinChange} unlock={unlock} err={pinErr} />;
  const active = tools.find(t => t.id === tab);
  return (
    <div className="app">
      <aside>
        <div className="brand">✦ LocalKit <b>V9.2</b></div>
        <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>⌂ Dashboard</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>⚙ Privacy</button>
        <div className="sideTitle">TOOLS</div>
        {tools.map(t => <button className={tab === t.id ? 'active' : ''} key={t.id} onClick={() => setTab(t.id)}>{t.icon} {t.name}</button>)}
      </aside>
      <main>
        <header>
          <div>
            <div className="eyebrow">OFFLINE-FIRST • LOCAL PROCESSING</div>
            <h1>{tab === 'settings' ? 'Privacy Center' : active?.name || 'Your private toolkit'}</h1>
          </div>
          <div className="headerActions">
            <InstallButton />
            <button className="lockbtn" disabled={!localStorage.getItem(LS.pinVerifier) && !localStorage.getItem(LS.pin)} onClick={() => setLocked(true)}>🔒 Lock</button>
          </div>
        </header>
        <div key={tab} className="view">
          {tab === 'home'
            ? <Home q={q} setQ={setQ} visible={visible} fav={fav} setFav={setFav} open={setTab} />
            : tab === 'settings'
              ? <Privacy pin={pin} setPin={onPinChange} setPrivacy={setPrivacy} disable={disable} />
              : active
                ? <ToolView id={active.id} />
                : null}
        </div>
      </main>
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

function Lock({ pin, setPin, unlock, err }: { pin: string; setPin: (s: string) => void; unlock: () => void; err: string }) {
  return (
    <div className="lock">
      <div className="lockcard">
        <div className="orb">🔐</div>
        <h1>LocalKit Locked</h1>
        <p>Unlock stays on this device.</p>
        <input
          autoFocus
          inputMode="numeric"
          maxLength={6}
          type="password"
          aria-label="6-digit app lock PIN"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && unlock()}
          placeholder="6-digit PIN"
        />
        {err && <p className="err" role="alert">{err}</p>}
        <button onClick={unlock}>Unlock</button>
        <small>The app PIN is a device-level convenience lock. It is separate from your vault master password and does not encrypt vault data.</small>
      </div>
    </div>
  );
}

type HomeProps = {
  q: string; setQ: (s: string) => void; visible: Tool[];
  fav: string[]; setFav: React.Dispatch<React.SetStateAction<string[]>>; open: (id: string) => void;
};
function Home(p: HomeProps) {
  return (
    <>
      <section className="hero">
        <div>
          <span className="pill">● 100% LOCAL</span>
          <h2>Power tools.<br /><em>Zero cloud.</em></h2>
          <p>Documents, secrets, images, QR, code, files, colors, units and calculations in one offline workspace.</p>
          <input className="search" aria-label="Search tools" value={p.q} onChange={e => p.setQ(e.target.value)} placeholder="⌕ Search tools…" />
        </div>
        <div className="heroArt"><div className="ring">✦</div></div>
      </section>
      <div className="stats">
        <div><b>13</b><span>Tools</span></div>
        <div><b>0</b><span>Required servers</span></div>
        <div><b>Local</b><span>Processing</span></div>
        <div><b>{p.fav.length}</b><span>Favorites</span></div>
      </div>
      <h3>Toolbox</h3>
      <div className="grid">
        {p.visible.map(t =>
          <article className="card" key={t.id} onClick={() => p.open(t.id)}>
            <button className="star" aria-label={p.fav.includes(t.id) ? `Remove ${t.name} from favorites` : `Add ${t.name} to favorites`} onClick={e => { e.stopPropagation(); p.setFav(f => f.includes(t.id) ? f.filter(x => x !== t.id) : [...f, t.id]); }}>{p.fav.includes(t.id) ? '★' : '☆'}</button>
            <div className="icon">{t.icon}</div>
            <h4>{t.name}</h4>
            <p>{t.desc}</p>
            <span>Open →</span>
          </article>
        )}
      </div>
    </>
  );
}

function Privacy({ pin, setPin, setPrivacy, disable }: { pin: string; setPin: (s: string) => void; setPrivacy: () => void; disable: () => void }) {
  return (
    <section className="panel">
      <div className="bigicon">🛡️</div>
      <h2>Privacy Center</h2>
      <p>Set a six-digit local app lock. The app lock is separate from vault encryption: the vault uses its own master password.</p>
      <input inputMode="numeric" maxLength={6} aria-label="New 6-digit PIN" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="New 6-digit PIN" />
      <button onClick={setPrivacy}>Enable / Update PIN</button>
      <button className="danger" onClick={disable}>Disable PIN</button>
      <div className="security">
        <b>Security model</b>
        <span>• The 6-digit PIN is an app lock only — it does not encrypt vault data</span>
        <span>• Vault records are AES-GCM encrypted with PBKDF2-derived keys and a fresh IV per record</span>
        <span>• No cloud upload — files are processed in your browser</span>
        <span>• localStorage holds UI state, encrypted vault records and a salted PIN verifier — never plaintext secrets</span>
        <span>• Browser/device compromise is outside this app’s security boundary</span>
      </div>
    </section>
  );
}

// ---------- mobile bottom navigation + all-tools sheet ----------

function BottomNav({ tab, setTab }: { tab: string; setTab: (s: string) => void }) {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMore(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);
  const items = [
    { id: 'home', icon: '⌂', label: 'Home' },
    { id: 'vault', icon: '🔐', label: 'Vault' },
    { id: 'pdf', icon: '📄', label: 'PDF' },
    { id: 'calc', icon: '🧮', label: 'Calc' }
  ];
  return (
    <>
      <nav className="bottomNav" aria-label="Primary navigation">
        {items.map(i => (
          <button key={i.id} className={tab === i.id ? 'on' : ''} aria-current={tab === i.id ? 'page' : undefined} onClick={() => setTab(i.id)}>
            <span className="navIcon">{i.icon}</span>
            <span className="navLabel">{i.label}</span>
          </button>
        ))}
        <button className={more ? 'on' : ''} aria-expanded={more} aria-haspopup="dialog" onClick={() => setMore(!more)}>
          <span className="navIcon">⋯</span>
          <span className="navLabel">More</span>
        </button>
      </nav>
      {more && (
        <div className="sheetWrap" role="dialog" aria-modal="true" aria-label="All tools" onClick={() => setMore(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheetGrab" aria-hidden="true"></div>
            <h3>All tools</h3>
            <div className="sheetGrid">
              {tools.filter(t => !['vault', 'pdf', 'calc'].includes(t.id)).map(t => (
                <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => { setTab(t.id); setMore(false); }}>
                  <span className="sheetIcon">{t.icon}</span>
                  <span className="sheetName">{t.name}</span>
                  <span className="sheetDesc">{t.desc}</span>
                </button>
              ))}
              <button className={tab === 'settings' ? 'on' : ''} onClick={() => { setTab('settings'); setMore(false); }}>
                <span className="sheetIcon">⚙️</span>
                <span className="sheetName">Privacy</span>
                <span className="sheetDesc">App lock and security settings</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- GZIP Compressor ----------

function Compressor() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const [err, setErr] = useState('');
  const run = async () => {
    setErr(''); setInfo('');
    if (!file) return;
    if (!(window as any).CompressionStream) {
      setErr('GZIP compression is not supported in this browser. Try a recent version of Chrome, Edge, Firefox or Safari.');
      return;
    }
    setBusy(true);
    try {
      const cs = new CompressionStream('gzip');
      const stream = new Blob([await file.arrayBuffer()]).stream().pipeThrough(cs);
      const blob = await new Response(stream).blob();
      if (blob.size === 0 && file.size > 0) throw new Error('compression produced an empty result');
      const pct = file.size > 0 ? Math.max(0, Math.round((1 - blob.size / file.size) * 100)) : 0;
      setInfo(`${bytes(file.size)} → ${bytes(blob.size)} (${pct}% smaller)`);
      download(blob, file.name + '.gz');
    } catch {
      setErr('Compression failed — the file could not be processed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Workspace icon="🗜️" title="GZIP Compressor" desc="GZIP compression runs entirely in your browser; nothing is uploaded. Output is a .gz file.">
      <input type="file" aria-label="File to compress" onChange={e => { setFile(e.target.files?.[0] || null); setInfo(''); setErr(''); }} />
      {file && <p>{file.name} • {bytes(file.size)}</p>}
      <button disabled={!file || busy} onClick={run}>{busy ? 'Compressing…' : 'Compress & Download .gz'}</button>
      {info && <p>{info}</p>}
      {err && <p className="err" role="alert">{err}</p>}
    </Workspace>
  );
}

// ---------- Text Studio (safe Markdown subset) ----------

function inlineNodes(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0, key = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tk = m[0];
    if (tk.startsWith('**')) parts.push(<strong key={key++}>{tk.slice(2, -2)}</strong>);
    else if (tk.startsWith('*')) parts.push(<em key={key++}>{tk.slice(1, -1)}</em>);
    else if (tk.startsWith('`')) parts.push(<code key={key++}>{tk.slice(1, -1)}</code>);
    else {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tk);
      // only http(s) links are rendered; everything else stays literal text
      if (lm && /^https?:\/\//i.test(lm[2]))
        parts.push(<a key={key++} href={lm[2]} target="_blank" rel="noopener noreferrer">{lm[1]}</a>);
      else parts.push(tk);
    }
    last = m.index + tk.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Renders a safe Markdown subset: #/##/### headings, - lists, 1. lists,
 *  **bold**, *italic*, `code`, and [links](https://…). React escapes all
 *  text — no HTML is ever injected, so malformed input just renders as text. */
function renderMarkdown(src: string): React.ReactNode[] {
  const lines = src.split('\n');
  const out: React.ReactNode[] = [];
  let i = 0, key = 0;
  const isSpecial = (l: string) => /^(#{1,3}\s|\s*[-*]\s|\s*\d+\.\s)/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      out.push(React.createElement('h' + h[1].length, { key: key++ }, inlineNodes(h[2])));
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
      out.push(<ul key={key++}>{items.map((it, j) => <li key={j}>{inlineNodes(it)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      out.push(<ol key={key++}>{items.map((it, j) => <li key={j}>{inlineNodes(it)}</li>)}</ol>);
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isSpecial(lines[i])) { para.push(lines[i]); i++; }
    out.push(<p key={key++}>{inlineNodes(para.join(' '))}</p>);
  }
  return out;
}

function TextStudio() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'preview' | 'text'>('preview');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  return (
    <Workspace icon="📝" title="Text Studio" desc="Markdown preview (headings, lists, links, bold/italic, inline code), word count and case tools. Everything runs locally.">
      <textarea aria-label="Text editor" value={text} onChange={e => setText(e.target.value)} placeholder={'# Heading\nWrite your text here…'} />
      <div className="actions">
        <button onClick={() => setText(text.toUpperCase())}>UPPERCASE</button>
        <button onClick={() => setText(text.toLowerCase())}>lowercase</button>
        <button onClick={() => navigator.clipboard?.writeText(text)}>Copy</button>
        <button onClick={() => setMode(mode === 'preview' ? 'text' : 'preview')}>{mode === 'preview' ? 'Show text' : 'Preview'}</button>
      </div>
      <p>{words} words • {chars} characters</p>
      {mode === 'preview' && <div className="panel">{renderMarkdown(text)}</div>}
    </Workspace>
  );
}

// ---------- File Inspector (content-hash duplicate detection) ----------

type InspectRow = { name: string; size: number; type: string; modified: string; hash: string; error?: string };
function Inspector() {
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<InspectRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const run = async () => {
    if (!files.length) return;
    setBusy(true);
    setRows([]);
    const out: InspectRow[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress(`Hashing ${i + 1}/${files.length}: ${f.name}`);
        const base: InspectRow = {
          name: f.name,
          size: f.size,
          type: f.type || 'unknown',
          modified: new Date(f.lastModified).toLocaleString(),
          hash: ''
        };
        try {
          if (f.size === 0) { out.push({ ...base, error: 'empty file — no content hash'}); continue; }
          const digest = await crypto.subtle.digest('SHA-256', await f.arrayBuffer());
          base.hash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
        } catch {
          base.error = 'could not hash this file';
        }
        out.push(base);
      }
    } finally {
      setRows(out);
      setProgress('');
      setBusy(false);
    }
  };

  // duplicates = identical SHA-256 content hash AND identical size
  const groups = new Map<string, InspectRow[]>();
  for (const r of rows) if (r.hash && !r.error) {
    const k = r.hash + ':' + r.size;
    groups.set(k, [...(groups.get(k) || []), r]);
  }
  const dupGroups = [...groups.values()].filter(g => g.length > 1);

  return (
    <Workspace icon="🔎" title="File Inspector" desc="Local file metadata and SHA-256 content hashing. Files with identical content hashes and sizes are grouped as duplicates. No upload or cloud service.">
      <input type="file" multiple aria-label="Files to inspect" onChange={e => { setFiles([...e.target.files || []]); setRows([]); }} />
      <button disabled={!files.length || busy} onClick={run}>{busy ? progress || 'Working…' : 'Inspect & hash files'}</button>
      {rows.length > 0 && (
        <div className="filelist">
          {rows.map((r, idx) => (
            <span key={idx}>
              {r.name} • {bytes(r.size)} • {r.type} • {r.modified}
              {r.hash ? ` • SHA-256: ${r.hash.slice(0, 24)}…` : ''}
              {r.error ? ` • ⚠ ${r.error}` : ''}
            </span>
          ))}
        </div>
      )}
      {rows.length > 1 && (
        dupGroups.length > 0 ? (
          <div className="note">
            <b>Duplicate content detected</b>
            {dupGroups.map((g, i) => (
              <p key={i}>These files have identical content (same SHA-256 and size): {g.map(x => x.name).join(', ')}</p>
            ))}
          </div>
        ) : <p className="muted">No duplicate content found among the selected files.</p>
      )}
      {rows.some(r => r.hash) && <textarea readOnly aria-label="Full SHA-256 hashes" value={rows.filter(r => r.hash).map(r => `${r.name}: ${r.hash}`).join('\n')} />}
    </Workspace>
  );
}

// ---------- Password Generator ----------

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

// ---------- PDF Studio ----------

async function loadPdf(f: File): Promise<PDFDocument> {
  if (f.size === 0) throw new Error(`${f.name}: the file is empty.`);
  let buf: ArrayBuffer;
  try {
    buf = await f.arrayBuffer();
  } catch {
    throw new Error(`${f.name}: the file could not be read.`);
  }
  try {
    return await PDFDocument.load(buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/encrypt/i.test(msg)) throw new Error(`${f.name}: password-protected PDFs are not supported.`);
    throw new Error(`${f.name}: not a valid PDF (it may be corrupted or unsupported).`);
  }
}

function PDFTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');

  const merge = async () => {
    if (!files.length) return;
    setBusy(true); setErr(''); setStatus('Merging…');
    try {
      const out = await PDFDocument.create();
      for (const f of files) {
        const src = await loadPdf(f);
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach(p => out.addPage(p));
      }
      download(new Blob([(await out.save()).slice()], { type: 'application/pdf'}), 'merged.pdf');
      setStatus(`Merged ${files.length} file(s).`);
    } catch (e) {
      setStatus('');
      setErr(e instanceof Error ? e.message : 'Merge failed — one of the files could not be processed.');
    } finally {
      setBusy(false);
    }
  };

  const extract = async () => {
    if (!files[0]) return;
    setBusy(true); setErr(''); setStatus('Reading PDF…');
    try {
      const src = await loadPdf(files[0]);
      const count = src.getPageCount();
      if (count === 0) { setStatus('This PDF has no pages.'); return; }
      const entries: { name: string; data: Uint8Array }[] = [];
      for (let i = 0; i < count; i++) {
        setStatus(`Extracting page ${i + 1} of ${count}…`);
        const out = await PDFDocument.create();
        const [p] = await out.copyPages(src, [i]);
        out.addPage(p);
        entries.push({ name: `page-${i + 1}.pdf`, data: await out.save() });
      }
      const base = files[0].name.replace(/\.pdf$/i, '') || 'document';
      download(createZip(entries), `${base}-pages.zip`);
      setStatus(`Extracted ${count} page(s) into ${base}-pages.zip.`);
    } catch (e) {
      setStatus('');
      setErr(e instanceof Error ? e.message : 'Extraction failed — the file could not be processed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Workspace icon="📄" title="PDF Studio" desc="Merge PDFs or extract every page into a single ZIP download. All processing stays in your browser.">
      <input type="file" accept="application/pdf" multiple aria-label="PDF files" onChange={e => { setFiles([...e.target.files || []]); setErr(''); setStatus(''); }} />
      <div className="actions">
        <button disabled={busy || !files.length} onClick={merge}>{busy ? 'Working…' : 'Merge PDFs'}</button>
        <button disabled={busy || !files[0]} onClick={extract}>Extract pages → ZIP</button>
      </div>
      {status && <p className="muted" role="status">{status}</p>}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="filelist">{files.map((f, i) => <span key={f.name + i}>{f.name} • {bytes(f.size)}</span>)}</div>
    </Workspace>
  );
}

// ---------- Privacy Vault ----------

type VaultRecord = { id: string; name: string; cipher: string; iv: string };
type VaultMeta = { v: 1; salt: string; check: { iv: string; cipher: string } };
const VAULT_DATA_KEY = 'lk-v7-vault';
const VAULT_META_KEY = 'lk-v7-vault-meta';
const LEGACY_SALT_KEY = 'lk-v7-vault-salt';
const VAULT_CHECK_TOKEN = 'lk-vault-check-v1';

function validRecords(v: unknown): VaultRecord[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (x): x is VaultRecord =>
      !!x && typeof x === 'object' &&
      typeof (x as VaultRecord).id === 'string' &&
      typeof (x as VaultRecord).name === 'string' &&
      typeof (x as VaultRecord).cipher === 'string' &&
      typeof (x as VaultRecord).iv === 'string'
  );
}

function Vault() {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [master, setMaster] = useState('');
  const [data, setData] = useState<VaultRecord[]>(() => validRecords(load(VAULT_DATA_KEY, [])));
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  const derive = async (p: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> =>
    crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256'},
      await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveKey']),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

  const persist = (records: VaultRecord[]): boolean => {
    if (!save(VAULT_DATA_KEY, records)) {
      setErr('Could not save the record — browser storage may be full.');
      return false;
    }
    return true;
  };

  const unlock = async () => {
    setErr(''); setNote('');
    if (!master) { setErr('Enter your vault master password.'); return; }
    try {
      const meta = load<VaultMeta | null>(VAULT_META_KEY, null);
      const metaOk = meta && meta.v === 1 && typeof meta.salt === 'string' &&
        meta.check && typeof meta.check.iv === 'string' && typeof meta.check.cipher === 'string';
      if (meta) {
        if (!metaOk) { setErr('Stored vault metadata is corrupted. Records cannot be unlocked in place.'); return; }
        const salt = fromB64(meta.salt);
        const k = await derive(master, salt);
        try {
          // authenticate the password against the encrypted check token
          const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(meta.check.iv) }, k, fromB64(meta.check.cipher));
          if (new TextDecoder().decode(pt) !== VAULT_CHECK_TOKEN) throw new Error('mismatch');
        } catch {
          setErr('Wrong master password.');
          return;
        }
        setKey(k);
        return;
      }
      // no metadata yet: create (or upgrade a legacy pre-metadata vault)
      const legacyRaw = localStorage.getItem(LEGACY_SALT_KEY);
      const salt = legacyRaw ? fromB64(legacyRaw) : crypto.getRandomValues(new Uint8Array(16));
      const k = await derive(master, salt);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(VAULT_CHECK_TOKEN));
      const m: VaultMeta = { v: 1, salt: b64bytes(salt), check: { iv: b64bytes(iv), cipher: b64bytes(new Uint8Array(cipher)) } };
      if (!save(VAULT_META_KEY, m)) { setErr('Could not initialize vault metadata — browser storage may be full.'); return; }
      localStorage.removeItem(LEGACY_SALT_KEY);
      setKey(k);
      setNote(data.length
        ? 'Legacy vault upgraded: wrong passwords are now detected before records are used.'
        : 'New vault created with this master password.');
    } catch {
      setErr('Vault unlock failed — Web Crypto may be unavailable in this browser.');
    }
  };

  const add = async () => {
    setErr('');
    if (!key) return;
    if (!secret.trim()) { setErr('Enter a secret to encrypt and save.'); return; }
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12)); // fresh IV per encryption
      const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secret));
      const rec: VaultRecord = { id: crypto.randomUUID(), name: name.trim() || 'Secret', cipher: b64bytes(new Uint8Array(c)), iv: b64bytes(iv) };
      const next = [rec, ...data];
      if (!persist(next)) return;
      setData(next);
      setName(''); setSecret('');
    } catch {
      setErr('Encryption failed — Web Crypto may be unavailable in this browser.');
    }
  };

  const remove = (id: string) => {
    setErr('');
    const next = data.filter(x => x.id !== id);
    if (persist(next)) setData(next);
  };

  const reveal = async (x: VaultRecord) => {
    try {
      if (!key) return;
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(x.iv) }, key, fromB64(x.cipher));
      alert(new TextDecoder().decode(pt));
    } catch {
      alert('This record could not be decrypted — it may be corrupted, or it was saved with a different master password.');
    }
  };

  return (
    <Workspace icon="🔐" title="Privacy Vault" desc="AES-GCM encrypted records; the master key is derived from your password and held in memory only while the vault is unlocked.">
      {!key ? (
        <div className="panelInner">
          <input type="password" aria-label="Vault master password" value={master} onChange={e => { setMaster(e.target.value); setErr(''); }} placeholder="Vault master password" />
          <button onClick={unlock}>Unlock vault</button>
          <p className="muted">First unlock creates a fresh vault with this password.</p>
          <p className="muted">⚠ If you forget the master password, encrypted records cannot be recovered — there is no reset and no export without it.</p>
          {err && <p className="err" role="alert">{err}</p>}
          {note && <p className="muted" role="status">{note}</p>}
        </div>
      ) : (
        <>
          <div className="two">
            <div>
              <input aria-label="Record label" value={name} onChange={e => setName(e.target.value)} placeholder="Label" />
              <input type="password" aria-label="Secret to encrypt" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Secret" />
              <button onClick={add}>＋ Encrypt & Save</button>
              {err && <p className="err" role="alert">{err}</p>}
            </div>
            <div>
              {data.map(x => (
                <div className="note" key={x.id}>
                  <b>🔑 {x.name}</b>
                  <p>Encrypted record • {x.cipher.slice(0, 16)}…</p>
                  <button onClick={() => reveal(x)}>Reveal</button>
                  <button onClick={() => remove(x.id)}>Delete</button>
                </div>
              ))}
              {!data.length && <p className="muted">No records yet. Secrets are encrypted before they are stored on this device.</p>}
            </div>
          </div>
        </>
      )}
    </Workspace>
  );
}

// ---------- Invoice Pro (multiple line items) ----------

type LineItem = { desc: string; qty: string; rate: string };
function parseNum(s: string): number | null {
  const v = Number(String(s).trim());
  return Number.isFinite(v) && v >= 0 ? v : null;
}
function Invoice() {
  const [biz, setBiz] = useState('LocalKit');
  const [cust, setCust] = useState('Customer');
  const [tax, setTax] = useState('18');
  const [items, setItems] = useState<LineItem[]>([{ desc: 'Service', qty: '1', rate: '1000'}]);
  const [err, setErr] = useState('');

  const safe = (v: string) => parseNum(v) ?? 0;
  const subtotal = items.reduce((s, it) => s + safe(it.qty) * safe(it.rate), 0);
  const taxRate = parseNum(tax) ?? 0;
  const gst = subtotal * taxRate / 100;
  const hasInvalid = items.some(it => parseNum(it.qty) === null || parseNum(it.rate) === null) || parseNum(tax) === null;

  const update = (i: number, patch: Partial<LineItem>) =>
    setItems(arr => arr.map((it, j) => j === i ? { ...it, ...patch } : it));
  const addItem = () => setItems(arr => [...arr, { desc: '', qty: '1', rate: ''}]);
  const removeItem = (i: number) => setItems(arr => arr.length > 1 ? arr.filter((_, j) => j !== i) : arr);

  const pdf = async () => {
    setErr('');
    if (hasInvalid) { setErr('Fix the highlighted input problems before exporting (quantities, rates and GST must be valid numbers).'); return; }
    try {
      const d = await PDFDocument.create();
      let p = d.addPage([595, 842]);
      let y = 780;
      p.drawText('INVOICE', { x: 50, y, size: 24 }); y -= 35;
      p.drawText(`${pdfSafe(biz)} - ${pdfSafe(cust)}`, { x: 50, y, size: 12 }); y -= 45;
      for (const it of items) {
        if (y < 120) { p = d.addPage([595, 842]); y = 780; }
        p.drawText(`${pdfSafe(it.desc || 'Item')}  x ${safe(it.qty)}  @ ${safe(it.rate).toFixed(2)}`, { x: 50, y, size: 12 });
        p.drawText(`Rs. ${(safe(it.qty) * safe(it.rate)).toFixed(2)}`, { x: 400, y, size: 12 });
        y -= 22;
      }
      if (y < 160) { p = d.addPage([595, 842]); y = 780; }
      y -= 10;
      p.drawText(`Subtotal: Rs. ${subtotal.toFixed(2)}`, { x: 50, y: Math.max(60, y -= 30), size: 12 });
      p.drawText(`GST (${taxRate}%): Rs. ${gst.toFixed(2)}`, { x: 50, y: y - 25, size: 12 });
      p.drawText(`TOTAL: Rs. ${(subtotal + gst).toFixed(2)}`, { x: 50, y: y - 55, size: 16 });
      download(new Blob([(await d.save()).slice()], { type: 'application/pdf'}), 'invoice.pdf');
    } catch {
      setErr('PDF export failed — please check the invoice fields (avoid unusual symbols in text).');
    }
  };

  return (
    <Workspace icon="🧾" title="Invoice Pro" desc="GST invoice with multiple line items and PDF export.">
      <div className="two">
        <div>
          <input aria-label="Business name" value={biz} onChange={e => setBiz(e.target.value)} placeholder="Business" />
          <input aria-label="Customer name" value={cust} onChange={e => setCust(e.target.value)} placeholder="Customer" />
          <input aria-label="GST percentage" value={tax} onChange={e => setTax(e.target.value)} placeholder="GST %" inputMode="decimal" />
          {items.map((it, i) => (
            <div className="note" key={i}>
              <input aria-label={`Item ${i + 1} description`} value={it.desc} onChange={e => update(i, { desc: e.target.value })} placeholder={`Item ${i + 1} description`} />
              <input aria-label={`Item ${i + 1} quantity`} value={it.qty} onChange={e => update(i, { qty: e.target.value })} placeholder="Qty" inputMode="decimal" />
              <input aria-label={`Item ${i + 1} unit price`} value={it.rate} onChange={e => update(i, { rate: e.target.value })} placeholder="Unit price" inputMode="decimal" />
              <p>Line total: ₹{(safe(it.qty) * safe(it.rate)).toFixed(2)}{parseNum(it.qty) === null || parseNum(it.rate) === null ? ' ⚠ invalid number treated as 0' : ''}</p>
              {items.length > 1 && <button onClick={() => removeItem(i)}>Remove item</button>}
            </div>
          ))}
          <div className="actions">
            <button onClick={addItem}>＋ Add item</button>
          </div>
        </div>
        <div className="total">
          <span>Subtotal</span><b>₹{subtotal.toFixed(2)}</b>
          <span>GST</span><b>₹{gst.toFixed(2)}</b>
          <hr />
          <span>Total</span><strong>₹{(subtotal + gst).toFixed(2)}</strong>
          <button onClick={pdf}>Export PDF</button>
          {hasInvalid && <p className="err" role="alert">Some quantities, rates or the GST percentage are not valid numbers and are treated as 0.</p>}
          {err && <p className="err" role="alert">{err}</p>}
        </div>
      </div>
    </Workspace>
  );
}

// ---------- Image Lab ----------

function ImageTool() {
  const [file, setFile] = useState<File | null>(null);
  const [q, setQ] = useState(0.75);
  const [w, setW] = useState(1200);
  const [info, setInfo] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setErr(''); setInfo('');
    if (!file) return;
    setBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const im = new Image();
      im.decoding = 'async';
      await new Promise<void>((resolve, reject) => {
        im.onload = () => resolve();
        im.onerror = () => reject(new Error('The image could not be decoded — the file may be corrupted or in an unsupported format.'));
        im.src = url;
      });
      const target = Number.isFinite(w) && w > 0 ? Math.min(Math.round(w), im.naturalWidth || im.width) : im.naturalWidth || im.width;
      const ratio = (im.naturalHeight || im.height) / (im.naturalWidth || im.width);
      const c = document.createElement('canvas');
      c.width = Math.max(1, target);
      c.height = Math.max(1, Math.round(c.width * ratio));
      c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
      c.toBlob(b => {
        if (b) {
          setInfo(`${bytes(file.size)} → ${bytes(b.size)}`);
          download(b, 'localkit-image.webp');
        } else {
          setErr('WebP export is not supported in this browser.');
        }
      }, 'image/webp', q);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Image processing failed.');
    } finally {
      // the object URL is no longer needed once the image is decoded
      URL.revokeObjectURL(url);
      setBusy(false);
    }
  };
  return (
    <Workspace icon="🖼️" title="Image Lab" desc="Resize and compress to WebP in your browser.">
      <input type="file" accept="image/*" aria-label="Image file" onChange={e => { setFile(e.target.files?.[0] || null); setInfo(''); setErr(''); }} />
      <label>Width <input type="number" min={1} aria-label="Target width in pixels" value={w} onChange={e => setW(+e.target.value)} /></label>
      <label>Quality <input type="range" min=".1" max="1" step=".05" aria-label="WebP quality" value={q} onChange={e => setQ(+e.target.value)} /></label>
      <button disabled={!file || busy} onClick={run}>{busy ? 'Processing…' : 'Compress / Resize'}</button>
      <p className="muted">{info}</p>
      {err && <p className="err" role="alert">{err}</p>}
    </Workspace>
  );
}

// ---------- QR Studio ----------

function QR() {
  const [text, setText] = useState('https://example.com');
  const [src, setSrc] = useState('');
  const [err, setErr] = useState('');
  const run = async () => {
    setErr('');
    if (!text.trim()) { setErr('Enter text or a URL first.'); return; }
    try {
      setSrc(await QRCode.toDataURL(text, { width: 800, margin: 2, errorCorrectionLevel: 'M'}));
    } catch {
      setErr('QR generation failed — try shorter text.');
    }
  };
  return (
    <Workspace icon="🧩" title="QR Studio" desc="Generate a high-resolution QR code locally.">
      <input aria-label="Text or URL to encode" value={text} onChange={e => setText(e.target.value)} placeholder="Text or URL" />
      <button onClick={run}>Generate QR</button>
      {err && <p className="err" role="alert">{err}</p>}
      {src && <div className="qr"><img src={src} alt="Generated QR code" /><a href={src} download="localkit-qr.png">Download PNG</a></div>}
    </Workspace>
  );
}

// ---------- Dev Forge ----------

function Dev() {
  const [input, setInput] = useState('');
  const [out, setOut] = useState('');
  const act = async (type: string) => {
    try {
      if (type === 'json') setOut(JSON.stringify(JSON.parse(input), null, 2));
      if (type === 'min') setOut(JSON.stringify(JSON.parse(input)));
      if (type === 'b64') setOut(b64bytes(new TextEncoder().encode(input)));
      if (type === 'b64dec') setOut(new TextDecoder().decode(fromB64(input.trim())));
      if (type === 'url') setOut(encodeURIComponent(input));
      if (type === 'dec') setOut(decodeURIComponent(input));
      if (type === 'sha') setOut(await sha256(input));
      if (type === 'uuid') setOut(crypto.randomUUID());
    } catch {
      setOut('Invalid input');
    }
  };
  return (
    <Workspace icon="🛠️" title="Dev Forge" desc="Every operation runs locally.">
      <textarea aria-label="Input" value={input} onChange={e => setInput(e.target.value)} placeholder="Input…" />
      <div className="actions">
        {[['json', 'Format JSON'], ['min', 'Minify JSON'], ['b64', 'Base64'], ['b64dec', 'Base64 Decode'], ['url', 'URL Encode'], ['dec', 'URL Decode'], ['sha', 'SHA-256'], ['uuid', 'UUID']].map(x => <button key={x[0]} onClick={() => act(x[0])}>{x[1]}</button>)}
      </div>
      <textarea readOnly aria-label="Output" value={out} placeholder="Output…" />
    </Workspace>
  );
}

// ---------- Calculator ----------

function Calc() {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('');
  const [qty, setQty] = useState('1000');
  const [gst, setGst] = useState('18');
  const [dAmt, setDAmt] = useState('1000');
  const [dPct, setDPct] = useState('10');
  const [p, setP] = useState('100000');
  const [rate, setRate] = useState('12');
  const [months, setMonths] = useState('12');

  const calc = () => {
    const r = evaluateExpression(expr);
    if (r.ok) setResult(String(r.value));
    else setResult('⚠ ' + r.error);
  };
  const g = gstCalc(qty, gst);
  const d = discountCalc(dAmt, dPct);
  const e = emiCalc(p, rate, months);
  const money = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <Workspace icon="🧮" title="Calculator" desc="Safe expression calculator (no eval) plus dedicated GST, discount and EMI calculations.">
      <div className="calc">
        <input aria-label="Math expression" value={expr} onChange={e => setExpr(e.target.value)} onKeyDown={ev => ev.key === 'Enter' && calc()} placeholder="(12+8)*3" />
        <button onClick={calc}>= Calculate</button>
        <div className="answer">{result || '0'}</div>
      </div>
      <div className="two">
        <div className="note">
          <b>GST</b>
          <input aria-label="Amount" value={qty} onChange={e => setQty(e.target.value)} placeholder="Amount" inputMode="decimal" />
          <input aria-label="GST percentage" value={gst} onChange={e => setGst(e.target.value)} placeholder="GST %" inputMode="decimal" />
          <p>{'error' in g ? '⚠ ' + g.error : `GST ${money(g.gst)} • Total ${money(g.total)}`}</p>
        </div>
        <div className="note">
          <b>Discount</b>
          <input aria-label="Amount before discount" value={dAmt} onChange={e => setDAmt(e.target.value)} placeholder="Amount" inputMode="decimal" />
          <input aria-label="Discount percentage" value={dPct} onChange={e => setDPct(e.target.value)} placeholder="Discount %" inputMode="decimal" />
          <p>{'error' in d ? '⚠ ' + d.error : `− ${money(d.discount)} • Final ${money(d.final)}`}</p>
        </div>
      </div>
      <div className="note">
        <b>EMI (monthly)</b>
        <input aria-label="Loan principal" value={p} onChange={e => setP(e.target.value)} placeholder="Principal" inputMode="decimal" />
        <input aria-label="Annual interest rate" value={rate} onChange={e => setRate(e.target.value)} placeholder="Annual rate %" inputMode="decimal" />
        <input aria-label="Tenure in months" value={months} onChange={e => setMonths(e.target.value)} placeholder="Months" inputMode="numeric" />
        <p>{'error' in e ? '⚠ ' + e.error : `EMI ${money(e.emi)}/month • Total ${money(e.totalPayment)} • Interest ${money(e.totalInterest)}`}</p>
      </div>
    </Workspace>
  );
}

// ---------- shared workspace chrome & tool routing ----------

function ToolView({ id }: { id: string }) {
  switch (id) {
    case 'pdf': return <PDFTool />;
    case 'vault': return <Vault />;
    case 'invoice': return <Invoice />;
    case 'image': return <ImageTool />;
    case 'qr': return <QR />;
    case 'dev': return <Dev />;
    case 'calc': return <Calc />;
    case 'compress': return <Compressor />;
    case 'text': return <TextStudio />;
    case 'inspect': return <Inspector />;
    case 'pw': return <PassGen />;
    case 'units': return <Units />;
    case 'color': return <ColorStudio />;
    default: return null;
  }
}

function Workspace({ icon, title, desc, children }: { icon: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="workspace">
      <div className="workspaceHead">
        <div className="bigicon">{icon}</div>
        <div><h2>{title}</h2><p>{desc}</p></div>
      </div>
      <div className="toolbox">{children}</div>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>);
