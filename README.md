# LocalKit V9.4.0 — Stable Privacy Edition

## 14 shipped tools
1. Privacy Vault
2. PDF Studio
3. Invoice Pro
4. Image Lab
5. QR Studio
6. Developer Toolbox
7. Calculator
8. GZIP Compressor
9. Text Studio
10. File Inspector
11. PassGen (password generator)
12. Unit Convert
13. Color Studio
14. Stopwatch & Timer

V9.4.0 release: full Settings section (accent color, startup view, animation toggle,
storage manager with one-tap local data wipe, about panel) and a new Stopwatch tool
(precision stopwatch with laps, best/worst highlighting, countdown timer with presets
and an audio alarm, keyboard shortcuts). V9.3.0 release: three new offline tools — PassGen (crypto-secure password generator with
entropy estimate), Unit Convert (length, weight, temperature, data, speed, area) and Color
Studio (HEX/RGB/HSL conversion with WCAG contrast checking). V9.2.0 release: premium app-style UI refresh — mobile bottom navigation with an all-tools
bottom sheet, animated view transitions, a glassy sticky app bar, safe-area/notch handling and
a refined Material-inspired dark theme. No tool logic changed. V9.1.2 release: dependency security updates (`react-router-dom` 7.9.4 → 7.18.4, `vite` 7.1.7 → 7.3.6) clearing all `npm audit` advisories; `npm audit` now reports 0 vulnerabilities. Earlier releases removed the unused `dexie` dependency, added a `typecheck` script, and performed the V9.1 stabilization pass: removed dead code for previously dropped modules, fixed the
header title, made every tool description match its actual behavior, hardened the
vault (PBKDF2 + AES-GCM with a per-record fresh IV and encrypted password verifier),
fixed object-URL leaks in Image Lab, replaced per-page PDF downloads with a single
ZIP download, implemented invoice line items, calculator discount/EMI, file duplicate
detection (SHA-256 content hashing) and a safe Markdown subset, and added unit
tests for the calculator and ZIP writer.

### Privacy
- No application-level analytics.
- No cloud upload from the shipped tools.
- Selected files are processed in-browser.
- Vault uses Web Crypto (PBKDF2 key derivation, AES-GCM records, fresh IV per record).
- The 6-digit app PIN is a convenience lock only — it does not encrypt vault data.
- Browser/device compromise remains outside the app security boundary.

### Verify, test and build
```bash
npm ci
npm test
npm run typecheck
npm run verify
npm run build
```

### GitHub Pages deployment

The repository is a normal source repository — never commit `node_modules/` or
`dist/`. Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs
`npm ci` → `npm test` → `npm run typecheck` → `npm run verify` → `npm run build`
and deploys the generated `dist/` to GitHub Pages via the official
`actions/upload-pages-artifact` / `actions/deploy-pages` actions. Any failing
step stops the deployment.

Required repository setting (once): Settings → Pages → Build and deployment →
Source: **GitHub Actions**.

The app is served from `/LocalKit/` (the deployment base path is defined once,
in `vite.config.ts`), so the site URL is:

    https://<username>.github.io/LocalKit/
