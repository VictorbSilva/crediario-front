# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is a Vite + React 19 + TypeScript project for **Crediário**, the application described in the sections below. The `create-vite` template has been removed; what exists now is an app shell and nothing more:

- `src/App.tsx` holds the router config (`BrowserRouter`, three routes: `/clientes`, `/rotas`, `/financeiro`, with `index` and `*` redirecting to `/clientes`).
- `src/components/layout/` holds the responsive shell — `AppShell` (sidebar at `md:`+, bottom tab bar below `md:`), `Sidebar`, `BottomNav`, `TopBar`, and `navItems.ts`, which is the **single source of navigation** consumed by both navs.
- `src/pages/` holds three placeholder pages; each renders `PageHeader` plus an "Ainda não implementado." card.
- No state-management pattern is established yet, and no business logic, data models, Firebase, or PWA config exist.

Styling conventions: Tailwind classes only — `src/index.css` is the **only** `.css` file in the project and holds just `@tailwind` directives plus a short `@layer base` block. Design tokens (the `brand` colour scale, `success`/`warning`/`danger`, font family) live in `tailwind.config.js`, which is the single source of truth; do not introduce a parallel CSS-variable token layer. The app is **light-theme only** (`color-scheme: light`); do not add `dark:` variants.

## Commands

- `npm run dev` — start the Vite dev server with HMR
- `npm run build` — type-check via `tsc -b` then production-build via `vite build`
- `npm run lint` — run ESLint over the repo
- `npm run preview` — serve the production build locally

There is no test runner configured yet (no test script, no test framework in `package.json`).

## Architecture

- Entry point: `index.html` → `src/main.tsx` mounts `<App />` from `src/App.tsx` into `#root` under `StrictMode`.
- TypeScript project references split app code from tooling: `tsconfig.json` references `tsconfig.app.json` (for `src/`) and `tsconfig.node.json` (for Vite config). Run type-checks via `tsc -b`, not `tsc` directly, since there's no root `include`.
- Path alias: `@/*` maps to `src/*` (configured in both `vite.config.ts` and `tsconfig.app.json` — keep these two in sync if the alias changes). `tsconfig.app.json` has **no `baseUrl`** (deprecated in TS 6, hard-fails in TS 7); `paths` therefore resolves relative to the config file and its entries must keep the leading `./`.
- ESLint uses the flat-config format (`eslint.config.js`) with `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`; type-aware lint rules are not enabled (see README for how to opt in).
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

- Front-end: React 19 + TypeScript + Tailwind CSS + Vite (PWA via vite-plugin-pwa).
- Data/Auth: Firebase — Firestore with offline persistence + Firebase Auth.
- Key libraries: firebase, @dnd-kit/core (drag-and-drop route assignment/reordering), vite-plugin-pwa.
- Hosting/CI: Vercel with Git integration (automatic deploys).
- One-off data load: a local Python/Pandas script imports the initial ~700 clients from an Excel spreadsheet directly into Firestore (runs locally, not part of the app).

## Domain Notes

- Core entities include clients, collection routes (with drag-and-drop ordering), and installment-based finances (installments, due dates, late-payment processing computed on demand).
- Financial rules (interest, penalties, rounding, payment states) are NOT fully specified yet — when implementing financial logic, state assumptions explicitly and ask before inventing business rules.

## Working Rules for Claude Code

- Prefer the smallest solution that delivers real value and can evolve later.
- Do not invent business requirements, data fields, or billing rules; flag assumptions instead.
- When touching Firestore code, always consider: collection/document structure, read/write patterns, required indexes, security rules, offline behavior, sync conflicts, and free-tier cost impact.
- Keep everything implementable, testable, and maintainable by ONE developer within the 30-day MVP window.
