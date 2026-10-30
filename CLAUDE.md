# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is a Vite + React 19 + TypeScript project for **Crediário**, the application described in the sections below. The `create-vite` template has been removed. The vertical foundation is done — shell, design system, PWA, auth and rules — and **clients, the carnê, routes and finances all use real Firestore data**; no screen is a demo:

- `src/components/layout/` holds the responsive shell — `AppShell` (sidebar at `md:`+, bottom tab bar below `md:`), `Sidebar`, `BottomNav`, `TopBar`, and `navItems.ts`, which is the **single source of navigation** consumed by both navs.
- `src/pages/LoginPage.tsx` uses Firebase Auth for login and password recovery; it does not read or write business collections.
- `src/pages/ClientesPage.tsx` reads the shared `clients` list, searches in memory and offers creation, archive/unarchive and export. On screens at least 1024 px wide, the selected client (the first result by default) mounts `PainelDoCliente`, which reads that client's carnê. Below that width, selecting a client navigates to `/clientes/:id`; the panel and its listeners do not mount.
- `src/pages/ClientePage.tsx` reads the client from `useClientes()` and its carnê from `useCarne`. It offers client editing (including visit days), archive/unarchive, sale creation, payment recording, payment cancellation and sale cancellation. Cancelling a sale never refunds a payment.
- `src/pages/RotasPage.tsx` reads and writes route fields in `clients` through `useClientes()`, with no listener of its own. It shows today's route with Visitado/Ausente/Desmarcar, plus a calendar of the current and next month. Ordering is per day of the month, so reordering 5/11 also changes the order for 5/10. A simple drag writes one client; a rebalance writes the returned changes in one batch. Visit marks never record payments.
- `src/pages/FinanceiroPage.tsx` is read-only: total receivables, overdue amounts, money received in the current month, overdue clients, and receivables for the selected month. It listens only to `sales` and `payments` through `useCarneDaEmpresa`, and reuses `useClientes()` for names and numbers. `src/lib/financeiro.ts` regenerates instalments in memory; it does not read `installments`. Receivables exclude simulated charges; money received includes the full amount of non-cancelled payments.
- Firebase Auth is wired (`src/auth/`), including password recovery. `src/lib/firebase.ts` initializes Firestore with a persistent multi-tab cache. There are three listener entry points, all with `includeMetadataChanges: true` and cleanup on unmount:
  - `src/data/ClientesProvider.tsx`: one shared `clients` listener, ordered by `numero`, while the authenticated `AppShell` is mounted and `businessId` exists.
  - `src/data/useCarne.ts`: three listeners (`sales`, `installments`, `payments`), filtered by `clientId`, while a client page or desktop panel is mounted with a known client. Changing client replaces the subscriptions.
  - `src/data/useCarneDaEmpresa.ts`: one listener per requested whole collection, while its consumer is mounted. Financeiro requests `sales` and `payments`; the export dialog requests all three. Closing the page/dialog ends those subscriptions.
- The four business collections are siblings under `businesses/{businessId}`: `clients`, `sales`, `installments`, `payments`. Route data lives in eight optional client fields: `diasDeVisita`, `rotaDesde`, `ordemPorDia`, `ordemDoDia`, `ultimaMarca`, `ultimaMarcaEm`, `ultimoVisitado`, `visitadoAnterior`; there is no route collection in use. `rotaId` remains accepted for compatibility. Clients also accept four optional fields: `rua`, `bairro`, `cidade` (the address in three fields; `endereco` remains accepted for older clients) and `proximaCobranca` (civil date). Sales have optional `cancelada`/`canceladaEm`; a missing `cancelada` means false. Sales also accept optional, immutable `itens` (a list of 1–30; the rule checks only type and size, the item contents and their sum are the code's job) and `periodicidade` (`'mensal'` or `'semanal'`; missing means monthly). A weekly sale requires `versaoCalculo: 2` and `diaVencimento` 1–7 (ISO weekday). The rules accept these six fields; no app code writes them yet. Payment cancellation uses `cancelado`/`canceladoEm`. Instalment status is derived, never stored.
- Export is a version 2 JSON backup (`crediario-backup`) of clients, sales, instalments and payments; CSV contains clients only. `ExportarClientes` mounts only while open and warns about partial caches, pending writes and inconsistent instalment counts; a carnê read error blocks JSON backup.
- `SyncBadge` in `TopBar` and `Sidebar` receives the **clients provider's** `estadoSync`; it does not aggregate carnê writes. `nao-configurado` remains a supported presentation/type state, but is not the state emitted by `estadoDeSync`.
- Writes do not `await` server acknowledgement; `.catch()` records failures in React state for the mounted provider/hook. **Those failures are not persisted across sessions.** There is no `erros` collection or recovery of rejections from a previous session in this MVP; adding error collection alone would not recover a callback lost on closing the app.
- PWA is configured (`vite-plugin-pwa`, `registerType: 'prompt'`, `devOptions` off). `PwaPrompt` mounts in `App`, outside the auth guard. Verified on 17/10/2026: `npm test` passes **1,005 tests in 43 files**; on 30/10/2026, `npm run test:rules` passes **176 tests in 3 files**. These counts describe this revision, not future coverage. CI (`.github/workflows/ci.yml`) runs lint, build, unit tests with a 70% coverage threshold and rule tests on pushes to `main` and on pull requests; it does not deploy. Firestore rules are deployed manually (`firebase deploy --only firestore:rules`). Keep `VITE_BUSINESS_ID` for Production unset until handover, so the owner receives `loja-principal` empty.
- The state pattern is set: context + provider + hook in three files (the split exists for `react-refresh/only-export-components`), mirrored from `src/auth/`. **All business decisions live in pure, tested functions under `src/lib/`** — `carne`, `cliente`, `cpf`, `data`, `dinheiro`, `exportacao`, `financeiro`, `parcelas`, `rotas`, `sync`, `texto`, `venda` — and components only wire them together.
- `src/lib/parcelas.ts` holds the whole carnê: `gerarParcelas`, `alocarPagamentos` (oldest instalment first), `situacaoDaParcela`, `simularEncargos` and `montarCarne`. **No instalment state is ever stored** — it is derived from due date plus payments. `src/data/useCarne.ts` mounts three listeners (`sales`, `installments`, `payments`) filtered by `clientId`, for the open client only; it is a hook, not a context, because nothing far away consumes it.
- The carnê screen reads and writes (etapas 4 and 5, both merged). `src/lib/carne.ts` holds presentation decisions — the instalment window, situation labels, plan texts — and `src/lib/venda.ts` holds validation and document assembly for sale and payment. Four rules the UI must not break:
  - **The interest/penalty toggle is born OFF and the balance shown by default is the plain agreed amount.**
  - The instalment count comes from `venda.numeroParcelas`, never `parcelas.length` — a partially delivered cache would otherwise say "2/3 pagas" for a 12-instalment carnê.
  - **A payment is written against the sale, never against an instalment.** The button sits on the instalment and pre-fills its remainder because that is how the owner thinks, but the document carries no `installmentId`; coverage stays derived oldest-first. There is a test refusing that field.
  - **Every constraint the rule enforces must also exist in the form.** Offline turns a server rejection into a silent, hours-late failure, far from whoever typed it — see the zero-centavo trap in `docs/armadilhas.md`.
- A sale and its instalments are written in one `writeBatch`: half a sale is worse than none, because the screen would show a carnê that does not add up. `useTelaLarga` decides panel-vs-page in JS rather than CSS: `hidden lg:block` would still mount the panel, and with it three Firestore listeners for a client nobody opened.
- Redo manual PWA/offline acceptance on the production build (`npm run preview:treino`) whenever the data layer changes. Automated tests and build success do not certify acceptance on the owner's device.

Styling conventions: Tailwind classes only — `src/index.css` is the **only** `.css` file in the project and holds just `@tailwind` directives plus a short `@layer base` block. Design tokens (the `brand` colour scale, `success`/`warning`/`danger`, font family) live in `tailwind.config.js`, which is the single source of truth; do not introduce a parallel CSS-variable token layer. The app is **light-theme only** (`color-scheme: light`); do not add `dark:` variants.

## Commands

Node **22** is required (`.nvmrc`, `package.json` engines `>=22 <23`, `.npmrc` engine-strict).
The standard scripts (`dev`, `build`, `lint`, `test`, `test:watch`, `test:coverage`, `generate-pwa-assets`) are in
`package.json` and do what their names say — except that `npm run dev` writes to
`loja-treino`, not `loja-principal`, because `.env.development` overrides `VITE_BUSINESS_ID`.
The scripts that need context:

- `npm run preview:treino` — production build with `--mode treino` (`.env.treino` points it at `loja-treino`), served on port 4174; the only local way to test PWA and offline. There is deliberately no plain `preview` script: after `npm run build` it would serve a bundle that writes to `loja-principal`.
- `npm run test:rules` — boots the Firestore emulator and runs the rule suite against it
- `npm run emu` — Firestore + Auth emulators, for working offline against fake data
- `npm run revisar -- main` — runs the local PR reviewer against the given base (defaults to `origin/main`).

`test:rules` and `emu` go through `scripts/firebase-com-jdk.mjs`, a wrapper that exists because an Oracle
Java 8 sits ahead of the JDK 21 in this machine's PATH and `firebase-tools` refuses it.

Vitest has its own `vitest.config.ts`, separate from `vite.config.ts`, so the test run does not load the PWA and React plugins. `globals` is deliberately off — importing `describe`/`it`/`expect` explicitly is what keeps `tsc -b` passing without extra type config. The default environment is `node`; a test that needs a real DOM (clicks, typing, effects that mount) opens with `// @vitest-environment jsdom` and calls `cleanup()` in `afterEach`, since RTL's auto-cleanup needs `globals`. `src/test/` holds test-only support — the `<dialog>` polyfill jsdom lacks and the stub behind the `virtual:pwa-register/react` alias — and is excluded from coverage. `npm run test:coverage` (what CI runs) fails below **70%** in any of statements, branches, functions or lines; see `docs/armadilhas.md` (`src/test/`) for the traps of writing these tests.

## Architecture

- TypeScript project references split app code from tooling: `tsconfig.json` references `tsconfig.app.json` (for `src/`) and `tsconfig.node.json` (for Vite config). Run type-checks via `tsc -b`, not `tsc` directly, since there's no root `include`.
- Path alias: `@/*` maps to `src/*` (configured in both `vite.config.ts` and `tsconfig.app.json` — keep these two in sync if the alias changes). `tsconfig.app.json` has **no `baseUrl`** (deprecated in TS 6, hard-fails in TS 7); `paths` therefore resolves relative to the config file and its entries must keep the leading `./`.
- Static assets referenced by absolute path (e.g. `/favicon.svg`) live in `public/`; assets imported by module path would be processed by Vite's bundler (there are none — the brand mark is drawn inline in `src/components/BrandMark.tsx`).

## Project: Crediário

- A credit-sales (crediário) management system for a small business with ~700 existing clients.
- MVP must ship in ~30 days, built and maintained by a single developer (CS student, afternoons available).
- Infrastructure budget is R$ 0.00 — only free tiers are allowed (Firebase Spark plan, Vercel free tier).
- Guiding principles: operational simplicity, delivery speed, low maintenance. NEVER suggest enterprise architectures, dedicated servers, microservices, message queues, Kubernetes, or paid infrastructure.

## Core Architectural Directives (non-negotiable)

- The application is Offline-First. It must work on-device first and sync to the cloud when connectivity returns.
- It is a PWA (via vite-plugin-pwa), installable on both mobile and desktop; UI must be usable on both form factors.
- No traditional relational backend. All data and auth live in Firebase (Firestore + Firebase Auth) using the web SDK with offline persistence enabled.
- Firestore is document-oriented. Routes currently use fields on `clients`, reusing the shared listener.
- State management: prioritize local state as the source of truth for the UI until Firestore confirms synchronization; surface pending-sync status to the user.
- Every data-access decision must respect Firebase Spark (free) plan limits: read/write quotas, security rules, and offline sync behavior.

## Stack

- Data/Auth: Firebase — Firestore with offline persistence + Firebase Auth.
- Hosting: Vercel free tier with Git integration (decided 24/09/2026 — do not reopen); `VITE_BUSINESS_ID` is set per environment in the Vercel dashboard, see `docs/armadilhas.md` (vercel.json). CI: GitHub Actions, verification only.
- No bulk data load. The owner declined importing the spreadsheet (decided 01/09/2026): the ~700 existing clients are entered by hand through the app, one at a time, as visits happen. Two consequences drive prioritisation — the client-creation form is the adoption path for the whole product, and the export feature is the only backup of data that will exist nowhere else.

## Domain Notes

- Core entities include clients, collection routes (with drag-and-drop ordering), and installment-based finances (installments, due dates, late-payment processing computed on demand).

### Financial rules — answered by the owner on 21/09/2026 (voice note)

These were the last open questions in the project. They are decided; do not re-derive or re-ask them. Quotes below are his.

- **There is no renegotiation feature and none will be built.** Renegotiation is verbal and never recorded: *"geralmente é mais só boca a boca… não formaliza nada"*. The installment plan stays exactly as issued. A R$ 300 sale in 3×100 whose client starts paying 50 at a time **remains a 3×100 plan** — the balance runs 300 → 250 → 200 and the overdue count keeps running against the **original** due dates: *"vai ficar atrasado e eu vou dando baixa… e sempre contando o atraso"*.
- **A payment is an arbitrary amount against a sale — never "installment N is paid".** Payments are an append-only ledger; installment status is *derived* by allocating payments oldest-first, so a partially covered installment stays overdue for the remainder, and "late since" is the due date of the oldest uncovered installment. This is the same shape C3 already forced: cancelling a payment is a new event with its own date, never a deletion, and the installment returns to overdue counted from its original due date.
- **Interest and penalty are a simulation, not a charge.** The owner does not collect them — *"eu não cobro, geralmente eu não cobro"*. They exist behind a toggle he switches on to show the client what the debt *would* be, as leverage: *"se eu fosse cobrar juros e multa ia dar 200 reais a mais, mas eu não estou nem cobrando isso… vai ajudar a dar uma pressão na cobrança"*. **The toggle defaults to OFF, and what is owed is the plain agreed amount.** Never show an inflated balance by default — the collector would ask for the wrong number at the door.
- **Penalty behaves like a boleto: one-off, applied once when the installment goes overdue. Interest is PER DAY — never per month.** His words and his reason: a daily figure visibly grows and pressures, where a monthly one does nothing for 30 days. **Do not build a per-month option.**
- **Because nothing is ever charged, no rate is frozen onto the installment.** The simulation is recomputed from the current rates and the days overdue, so there is no historical charge to preserve and `versaoCalculo` is not needed for this. If he ever does collect interest, it arrives as an ordinary payment of a larger amount — the ledger records what was received, not how it was split.
- Rates are **data the owner types** (penalty as % or fixed amount; interest as % per day), never rules in code. Rounding: nearest centavo, ties to even — the rule `src/lib/dinheiro.ts` already implements.
- **Late from the first day after the due date.** No grace period, and no grace-period field.

## Working Rules for Claude Code

- Prefer the smallest solution that delivers real value and can evolve later.
- Do not invent business requirements, data fields, or billing rules; flag assumptions instead.
- When touching Firestore code, always consider: collection/document structure, read/write patterns, required indexes, security rules, offline behavior, sync conflicts, and free-tier cost impact.
- Keep everything implementable, testable, and maintainable by ONE developer within the 30-day MVP window.

### Non-negotiable rules (from the external review, 28/08/2026)

- **Every Firestore read goes through a listener over the local cache.** No ad-hoc query in a hot screen — this is what keeps the project inside the Spark plan.
- **Every new collection is born with its own per-collection rule and the matching rule test, in the same commit.** The `match /{documento=**}` wildcard does not count as write authorization: with no Cloud Functions, the rule is the only schema validation this project will ever have.
- **Money is always integer centavos.** Never `parseFloat` a money string — use `parseReaisParaCentavos` from `src/lib/dinheiro.ts`.
- **Test PWA and offline behaviour on the production build only** (`npm run preview:treino`). `npm run dev` proves nothing: `devOptions` is off, so no service worker is registered. Never test with `npm run build` + `vite preview` — that bundle writes to `loja-principal`, the business the owner must receive empty.
- **Read `docs/armadilhas.md` before touching `vite.config.ts`, `src/lib/firebase.ts`, `pwa-assets.config.ts` or `firestore.rules`.** It records traps already paid for — bugs that do not show up in the build and only appear in production, offline, or on a specific platform.
- **When a modelling decision depends on an answer from the owner, first check whether it is reversible by construction.** If it is, implement the reversible path and move on instead of blocking. The general shape: store what the user typed *and* the derived result *and* a `versaoCalculo`, so that a later rule change is a recomputation of new records rather than a migration of old ones.
