# LocalKit build verification (V9.3.0)

All checks for this release were run from a clean dependency state
(`rm -rf node_modules && npm ci`) in a sandbox with network access.

Commands run and their meaning, in the order executed:

- `npm ci` — clean install of the pinned dependencies from the committed lockfile.
- `npm test` — unit tests for the calculator expression evaluator (tokenizer +
  shunting-yard, precedence, parentheses, decimals, unary minus, division by zero,
  invalid input), the GST/discount/EMI calculations, and the ZIP writer
  (signatures, entry counts, layout, CRC-32). Tests compile `src/calc.ts` and
  `src/zip.ts` via the dedicated `tsconfig.test.json`, which sets `"types": []`
  so compilation never depends on ambient `@types` auto-discovery (the root cause
  of earlier TS2688 failures with the old `npx tsc <files>` invocation) while
  keeping strict checking fully enabled.
- `npm run typecheck` — full strict TypeScript check (`tsc --noEmit`;
  `strict`, `noUnusedLocals`, `noUnusedParameters`), no emit.
- `npm run verify` — offline safety verification (`scripts/verify.mjs`):
  - required-file check
  - dangerous API scan across **all** files in `src/`
    (`eval`, `new Function`, `fetch`, `XMLHttpRequest`, `WebSocket`, `document.write`,
    `innerHTML`, `dangerouslySetInnerHTML`)
  - tool registry check (all 10 tool ids registered)
  - removed-feature check (`Screen`, `Brain`, `Share`, Second Brain, LAN Drop, Screenshot Lab)
  - vault crypto requirements (AES-GCM, PBKDF2, fresh 12-byte IV per encryption)
  - package version pinned to 9.3.0
- `npm run build` — `tsc -b` type check followed by a production Vite build.

Supplementary checks also performed: `npm ls --depth=0` (dependency tree fully
resolved; no missing or extraneous packages) and `npm audit` (0 vulnerabilities
for V9.1.2).

`npm run lint` — **not configured** in this project; reported as N/A rather than
substituted with a fake pass.

## Note on TS2688 "Cannot find type definition file" errors

An earlier validation run elsewhere reported TS2688 errors for
`babel__core`, `node`, `react`, `react-dom` and `qrcode`. Root cause
analysis: this project's `tsconfig.json` contains no `types` or `typeRoots`
references at all, so those errors cannot originate from the project
configuration — they occur when the type packages are absent from
`node_modules`, i.e. when dependencies were installed without
devDependencies (`--production` / `NODE_ENV=production`). All genuinely
required type packages (`@types/react`, `@types/react-dom`, `@types/qrcode`)
are pinned in `devDependencies`, and `npx tsc --noEmit` passes from a clean
install. No `@types/node` or `@types/babel__core` was added because nothing
in the type-checked source (`src/`) requires them.

## Build output

- `dist/` contains index.html, hashed JS/CSS assets, `manifest.webmanifest`
  (valid JSON with name, short_name, start_url, scope, display, theme colors
  and both icons), `registerSW.js`, `sw.js`, workbox runtime and both icon PNGs.
- The service worker precaches the full app shell plus icons (7 entries); every
  precache URL resolves to a real file in `dist/`.
- One Vite warning remains: the main JS chunk is ~713 kB minified
  (~271 kB gzipped), above the 500 kB chunk-size warning threshold. This is a
  size advisory, not a functional problem; code-splitting was left out to avoid
  an unnecessary redesign of the single-bundle architecture.

GitHub Actions (`.github/workflows/deploy.yml`) runs `npm ci`, `npm test`,
`npm run typecheck`, `npm run verify` and `npm run build` in that order on
Ubuntu runners, and deploys `dist/` to GitHub Pages via the official
`actions/upload-pages-artifact` + `actions/deploy-pages` actions. Any failing
step stops the deployment. The deployment base path `/LocalKit/` is defined
once in `vite.config.ts`; no application source hard-codes it. The built output
was additionally served locally (`vite preview`) and every `/LocalKit/` URL —
app shell, manifest, service worker, assets and icons — returned HTTP 200
with no root-level or missing paths.

## V9.3.0 new tools

Three new tools added, all fully offline with zero new dependencies: PassGen (password
generator using crypto.getRandomValues with a live entropy/strength estimate), Unit
Convert (length, weight, temperature, data, speed and area categories with unit swap) and
Color Studio (HEX/RGB/HSL conversion with WCAG AA/AAA contrast checking). The tool registry,
home stats and the verify.mjs tool-id list were extended accordingly. No existing tool
logic, the privacy model or the verification rules were changed.

## V9.2.0 UI refresh

App-style UI/UX overhaul, presentation only: new mobile bottom navigation (Home, Vault,
PDF, Calculator + More) with an all-tools bottom sheet, animated view transitions, glassy
sticky app bar, refined dark theme and safe-area insets. All tool logic, the tool
registry format, the verification rules and the offline/privacy model are unchanged.

## V9.1.2 dependency security update

`react-router-dom` 7.9.4 → 7.18.4 and `vite` 7.1.7 → 7.3.6. After the
upgrade, `npm audit` reports **0 vulnerabilities**. The application code is
unchanged; the app uses `BrowserRouter` only as a wrapper, so the router
upgrade is drop-in. Full gate re-verified from a clean `npm ci`: tests,
typecheck, verify and build all pass, and the built output was served with
`vite preview` with every `/LocalKit/` URL returning HTTP 200.
