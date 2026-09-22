# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is a Vite + React 19 + TypeScript project for **Crediário**, the application described in the sections below. The `create-vite` template has been removed. The vertical foundation is done — shell, design system, PWA, auth and rules — and **the clients screen persists to Firestore**; routes and finances are still demo data:

- `src/components/layout/` holds the responsive shell — `AppShell` (sidebar at `md:`+, bottom tab bar below `md:`), `Sidebar`, `BottomNav`, `TopBar`, and `navItems.ts`, which is the **single source of navigation** consumed by both navs.
- `src/pages/ClientesPage.tsx` reads and writes Firestore for real (create, search, archive), and `src/pages/ClientePage.tsx` (`/clientes/:id`) renders the carnê read-only. `RotasPage` and `FinanceiroPage` still render `src/demo/dadosDemo.ts` behind `DemoBanner`. The invariant is per screen: **no screen shows fake data without the banner, nor real data with it** — so `src/demo/` shrinks one screen at a time, it is not deleted wholesale.
- Firebase Auth is wired (`src/auth/`), including password recovery. `src/lib/firebase.ts` initializes Firestore with a persistent multi-tab cache, and `src/data/ClientesProvider.tsx` holds **the one and only `onSnapshot` in the app** — mounted in `AppShell` so list, form and sync badge share a single subscription. Writes never `await`; see `docs/armadilhas.md` before touching that file.
- PWA is configured (`vite-plugin-pwa`, `registerType: 'prompt'`, `devOptions` off). Security rules for `clients`, `sales`, `installments` and `payments` are written and tested against the emulator (99 rule tests, `npm run test:rules`). The `clients` rules were published to production on 03/09/2026 and the carnê ones (`sales`, `installments`, `payments`) on 22/09/2026, so **all four collections are writable**. CI (`.github/workflows/ci.yml`) runs lint, build and both suites on every push and PR — but it never deploys: `firestore.rules` is the one file in this project whose deploy is manual (`firebase deploy --only firestore:rules`), while Vercel publishes the app by itself on merge.
- The state pattern is set: context + provider + hook in three files (the split exists for `react-refresh/only-export-components`), mirrored from `src/auth/`. **All business decisions live in pure, tested functions under `src/lib/`** — `cliente`, `cpf`, `data`, `dinheiro`, `exportacao`, `parcelas`, `sync`, `texto` — and components only wire them together.
- `src/lib/parcelas.ts` holds the whole carnê: `gerarParcelas`, `alocarPagamentos` (oldest instalment first), `situacaoDaParcela`, `simularEncargos` and `montarCarne`. **No instalment state is ever stored** — it is derived from due date plus payments. `src/data/useCarne.ts` mounts three listeners (`sales`, `installments`, `payments`) filtered by `clientId`, for the open client only; it is a hook, not a context, because nothing far away consumes it.
- The carnê screen is read-only so far (etapa 4). `src/lib/carne.ts` holds its presentation decisions as pure functions — the instalment window, the situation labels, the plan texts. Two rules the UI must not break: **the interest/penalty toggle is born OFF and the balance shown by default is the plain agreed amount**, and the instalment count comes from `venda.numeroParcelas`, never `parcelas.length` — a partially delivered cache would otherwise say "2/3 pagas" for a 12-instalment carnê. `useTelaLarga` decides panel-vs-page in JS rather than CSS: `hidden lg:block` would still mount the panel, and with it three Firestore listeners for a client nobody opened.
- **The offline acceptance script of 12 steps was executed and passed on 21/09/2026**: data created offline survives closing the browser, syncs by itself in 3–5 s when the network returns, and the badge does not get stuck. Redo it on the production build (`npm run build && npm run preview`) whenever the data layer changes.

Styling conventions: Tailwind classes only — `src/index.css` is the **only** `.css` file in the project and holds just `@tailwind` directives plus a short `@layer base` block. Design tokens (the `brand` colour scale, `success`/`warning`/`danger`, font family) live in `tailwind.config.js`, which is the single source of truth; do not introduce a parallel CSS-variable token layer. The app is **light-theme only** (`color-scheme: light`); do not add `dark:` variants.

## Commands

The standard scripts (`dev`, `build`, `lint`, `preview`, `test`, `test:watch`) are in
`package.json` and do what their names say. The two that are **not** guessable:

- `npm run test:rules` — boots the Firestore emulator and runs the rule suite against it
- `npm run emu` — Firestore + Auth emulators, for working offline against fake data

Both go through `scripts/firebase-com-jdk.mjs`, a wrapper that exists because an Oracle
Java 8 sits ahead of the JDK 21 in this machine's PATH and `firebase-tools` refuses it.

Vitest has its own `vitest.config.ts`, separate from `vite.config.ts`, so the test run does not load the PWA and React plugins. `globals` is deliberately off — importing `describe`/`it`/`expect` explicitly is what keeps `tsc -b` passing without extra type config.

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
- Firestore is document-oriented and deliberately DENORMALIZED: duplicate fields such as client name and address into route collections when it reduces reads, simplifies screens, or improves offline behavior.
- State management: prioritize local state as the source of truth for the UI until Firestore confirms synchronization; surface pending-sync status to the user.
- Every data-access decision must respect Firebase Spark (free) plan limits: read/write quotas, security rules, and offline sync behavior.

## Stack

- Data/Auth: Firebase — Firestore with offline persistence + Firebase Auth.
- Hosting/CI: Vercel with Git integration (automatic deploys).
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
- **Test PWA and offline behaviour on the production build only** (`npm run build` then `npm run preview`). `npm run dev` proves nothing: `devOptions` is off, so no service worker is registered.
- **Read `docs/armadilhas.md` before touching `vite.config.ts`, `src/lib/firebase.ts`, `pwa-assets.config.ts` or `firestore.rules`.** It records traps already paid for — bugs that do not show up in the build and only appear in production, offline, or on a specific platform.
- **When a modelling decision depends on an answer from the owner, first check whether it is reversible by construction.** If it is, implement the reversible path and move on instead of blocking. The general shape: store what the user typed *and* the derived result *and* a `versaoCalculo`, so that a later rule change is a recomputation of new records rather than a migration of old ones.
