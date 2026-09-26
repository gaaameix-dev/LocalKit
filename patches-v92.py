# One-shot exact-match patch script for the LocalKit V9.2.0 UI refresh.
# Every patch asserts exactly one match; any mismatch aborts the run.

def patch(path, old, new, count=1):
    s = open(path, encoding='utf-8').read()
    assert s.count(old) == count, f"{path}: expected {count} match for {old[:60]!r}, got {s.count(old)}"
    open(path, 'w', encoding='utf-8').write(s.replace(old, new))

# --- src/main.tsx ---

patch('src/main.tsx', '<div className="brand">✦ LocalKit <b>V9</b></div>',
      '<div className="brand">✦ LocalKit <b>V9.2</b></div>')

patch('src/main.tsx', """        {tab === 'home'
          ? <Home q={q} setQ={setQ} visible={visible} fav={fav} setFav={setFav} open={setTab} />
          : tab === 'settings'
            ? <Privacy pin={pin} setPin={onPinChange} setPrivacy={setPrivacy} disable={disable} />
            : active
              ? <ToolView id={active.id} />
              : null}
      </main>
    </div>
  );""",
"""        <div key={tab} className="view">
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
  );""")

patch('src/main.tsx', """// ---------- GZIP Compressor ----------""",
"""// ---------- mobile bottom navigation + all-tools sheet ----------

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

// ---------- GZIP Compressor ----------""")

# restore the original no-space formatting of the InstallPromptEvent type
patch('src/main.tsx', "userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;",
      "userChoice: Promise<{ outcome: 'accepted' | 'dismissed'}>;")

# --- package.json ---

patch('package.json', '"version": "9.1.2"', '"version": "9.2.0"')

# --- scripts/verify.mjs ---

patch('scripts/verify.mjs', "if (pkg.version !== '9.1.2')", "if (pkg.version !== '9.2.0')")
patch('scripts/verify.mjs', "console.log('LocalKit V9.1.2 verification: PASS');", "console.log('LocalKit V9.2.0 verification: PASS');")

# --- README.md ---

patch('README.md', '# LocalKit V9.1.2 — Stable Privacy Edition', '# LocalKit V9.2.0 — Stable Privacy Edition')
patch('README.md',
 'V9.1.2 release: dependency security updates',
 'V9.2.0 release: premium app-style UI refresh — mobile bottom navigation with an all-tools\nbottom sheet, animated view transitions, a glassy sticky app bar, safe-area/notch handling and\na refined Material-inspired dark theme. No tool logic changed. V9.1.2 release: dependency security updates')

# --- BUILD-VERIFICATION.md ---

patch('BUILD-VERIFICATION.md', '# LocalKit build verification (V9.1.2)', '# LocalKit build verification (V9.2.0)')
patch('BUILD-VERIFICATION.md', '- package version pinned to 9.1.2', '- package version pinned to 9.2.0')
patch('BUILD-VERIFICATION.md',
 '## V9.1.2 dependency security update',
 '''## V9.2.0 UI refresh

App-style UI/UX overhaul, presentation only: new mobile bottom navigation (Home, Vault,
PDF, Calculator + More) with an all-tools bottom sheet, animated view transitions, glassy
sticky app bar, refined dark theme and safe-area insets. All tool logic, the tool
registry format, the verification rules and the offline/privacy model are unchanged.

## V9.1.2 dependency security update''')

print('V9.2.0 patches applied successfully')
