# tasks.md — Tyson & Zoe Monitor (Home CCTV Intelligence)
> Generated: 2026-03-31 | PRD ref: PRD.md
> Status legend: ⏳ PENDING | 🔄 IN PROGRESS | ✅ DONE | ❌ BLOCKED

---

## GROUP 1: Project Scaffold & Infrastructure Configs
**Depends on:** None
**Summary:** Create folder structure, env config, Docker Compose, Frigate/Mosquitto configs, and seed rules.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 1.1 | Create full folder structure per PRD §6 | ✅ | |
| 1.2 | Create `.env.example` with all env vars from PRD §7 | ✅ | [PARALLEL with 1.3] |
| 1.3 | Create `.gitignore` | ✅ | [PARALLEL with 1.2] |
| 1.4 | Create `config/mosquitto.conf` — local broker, no auth | ✅ | |
| 1.5 | Create `config/frigate.yml` — templated with placeholders | ✅ | |
| 1.6 | Seed `config/rules.json` with default rules | ✅ | |
| 1.7 | Create `docker-compose.yml` — 4 services on cctv-net | ✅ | |

---

## GROUP 2: Automation Service — Core ✅
**Depends on:** GROUP 1
**Summary:** Build the Node.js + TS automation service with MQTT subscription, rule engine, Telegram notifier, and SQLite event logger.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 2.1 | Init Node.js + TS project in `services/automation/` | ✅ | package.json + tsconfig.json |
| 2.2 | Install dependencies (mqtt, axios, better-sqlite3, express, cors, dotenv, node-telegram-bot-api + dev deps) | ✅ | + form-data for Telegram uploads |
| 2.3 | Implement `src/types.ts` — shared interfaces | ✅ | |
| 2.4 | Implement `src/eventLogger.ts` — SQLite schema + CRUD | ✅ | WAL mode, indexed queries |
| 2.5 | Implement `src/ruleEngine.ts` — rule eval + time restriction + rate limiting | ✅ | Overnight time ranges supported |
| 2.6 | Implement `src/notifier.ts` — Telegram sendPhoto + snapshot fetch | ✅ | 2.5s snapshot delay per PRD §11 |
| 2.7 | Implement `src/index.ts` — MQTT connect, subscribe, wire components | ✅ | Event dedup + reconnect logic |

---

## GROUP 3: Automation Service — API & Docker ✅
**Depends on:** GROUP 2
**Summary:** Add Express REST API for dashboard consumption and Dockerize the automation service.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 3.1 | Implement `src/apiServer.ts` — all /api/ routes (events, rules, cameras, health, snapshot) | ✅ | 6 endpoints, CORS enabled |
| 3.2 | Wire API server into `src/index.ts` | ✅ | startApiServer() called in main() |
| 3.3 | Create `services/automation/Dockerfile` — Node 20 Alpine multi-stage | ✅ | Fixed docker-compose volume paths + env vars |

---

## GROUP 4: Dashboard — Setup & Layout ✅
**Depends on:** GROUP 1
**Summary:** Initialize React + Vite + Tailwind dashboard with routing and sidebar layout.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 4.1 | Init React + Vite + TS + Tailwind in `dashboard/` | ✅ | Tailwind v4 + @tailwindcss/vite |
| 4.2 | Install deps: react-router-dom, axios, date-fns, lucide-react | ✅ | After 4.1 |
| 4.3 | Build `src/App.tsx` with React Router | ✅ | 4 routes: /events, /rules, /live, /settings |
| 4.4 | Build `src/components/Layout.tsx` — sidebar nav | ✅ | Dark theme, emerald accent, lucide icons |

---

## GROUP 5: Dashboard — Pages ✅
**Depends on:** GROUP 3, GROUP 4
**Summary:** Build all dashboard pages — events log, rules config, settings, live feed.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 5.1 | Build `EventsLog.tsx` — table with filters, snapshot thumbnails | ✅ | Camera/object/limit filters |
| 5.2 | Build `EventTable.tsx` + `SnapshotCard.tsx` components | ✅ | Click-to-expand snapshot modal |
| 5.3 | Build `RulesConfig.tsx` — rules list with toggles | ✅ | Toggle/edit/delete/add rule |
| 5.4 | Build `RuleModal.tsx` — edit modal for rules | ✅ | Full form with time restriction |
| 5.5 | Build `Settings.tsx` — Telegram config, cooldown | ✅ | Health status panel + .env guidance |
| 5.6 | Build `LiveFeed.tsx` — Frigate iframe + camera selector | ✅ | Camera dropdown + iframe reload |

---

## GROUP 6: Dashboard Docker & Integration ✅
**Depends on:** GROUP 5
**Summary:** Dockerize dashboard, wire all API calls, validate docker-compose end-to-end.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 6.1 | Create `dashboard/Dockerfile` — multi-stage (Node build → nginx) | ✅ | + nginx.conf with /api/ proxy + .dockerignore |
| 6.2 | Wire all API calls in pages via axios to VITE_API_URL | ✅ | Already wired; Docker uses empty VITE_API_URL → relative → nginx proxy |
| 6.3 | Verify docker-compose.yml service wiring — ports, env, depends_on | ✅ | Added build args, HOST_IP to .env.example |

---

## GROUP 7: Documentation ✅
**Depends on:** GROUP 6
**Summary:** Write README, architecture doc, and developer setup guide.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 7.1 | Write `README.md` — full setup guide, RTSP URL help, troubleshooting | ✅ | Setup steps, RTSP formats, troubleshooting |
| 7.2 | Write `architecture.md` — Mermaid diagram, component docs, data flow | ✅ | System + module diagrams, data model, design decisions |
| 7.3 | Write `docs/dev/setup.md` — developer setup without Docker | ✅ | Local dev for both services, manual MQTT testing |

---

## GROUP 8: CLI Package — tyson-zoe-cli ✅
**Depends on:** GROUP 7
**Summary:** NPM CLI package for one-command setup on any Mac/Windows laptop — Docker check, project download, interactive config, service management.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 8.1 | Scaffold project: package.json, tsconfig.json, .gitignore | ✅ | ESM, bin: tyson-zoe-monitor |
| 8.2 | Implement `src/banner.ts` — ASCII art branding + version | ✅ | picocolors |
| 8.3 | Implement `src/utils.ts` — OS detect, LAN IP, port check, install path | ✅ | Mac + Windows |
| 8.4 | Implement `src/installer.ts` — Docker check/install, repo clone, detect existing | ✅ | |
| 8.5 | Implement `src/config.ts` — interactive .env prompts, read/write config | ✅ | @clack/prompts |
| 8.6 | Implement `src/services.ts` — docker compose up/down/status/health/logs | ✅ | listr2 progress |
| 8.7 | Implement `src/index.ts` — entry point, menu router, first-run vs returning | ✅ | |
| 8.8 | Build + test end-to-end on Mac | ✅ | Banner, Docker check, clone, config prompts all working |
