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

---

## GROUP 9: Remote Diagnostics & RTSP Validation
**Depends on:** GROUP 3
**Summary:** Add diagnostic logging that pushes system health + RTSP connectivity results to a GitHub Gist every 1 min, accessible remotely for debugging.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 9.1 | Create `src/diagnostics.ts` — RTSP probe, MQTT check, Frigate health, network info, camera status | ✅ | |
| 9.2 | Create `src/gistLogger.ts` — create/update GitHub Gist with diagnostics JSON | ✅ | [PARALLEL with 9.1] |
| 9.3 | Wire diagnostics into `index.ts` — run on startup + every 1 min interval | ✅ | 15s initial delay, then every 60s |
| 9.4 | Add `/api/diagnostics` endpoint to `apiServer.ts` | ✅ | |
| 9.5 | Add `GITHUB_GIST_TOKEN` to `.env.example` | ✅ | [PARALLEL with 9.3] |
| 9.6 | Add RTSP stream validation to CLI `network.ts` — test actual stream not just TCP port | ✅ | ffprobe via Frigate container |

---

## GROUP 10: Twilio Phone Call Integration ✅
**Depends on:** GROUP 2
**Summary:** Add automated phone call alerts via Twilio when a rule matches — fires in parallel with Telegram.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 10.1 | Install `twilio` SDK in `services/automation/` | ✅ | |
| 10.2 | Create `src/twilioNotifier.ts` — TwiML voice call with spoken alert message, retry if no answer (2 retries) | ✅ | |
| 10.3 | Add Twilio env vars to `.env.example` | ✅ | [PARALLEL with 10.2] |
| 10.4 | Wire Twilio call into `index.ts` notification flow — fire in parallel with Telegram | ✅ | |
| 10.5 | Update dashboard `Settings.tsx` with Twilio config section | ✅ | |

---

## GROUP 11: Alexa Smart Home Skill — Lambda & Skill Backend
**Depends on:** GROUP 2
**Summary:** Create AWS Lambda handler for Alexa Smart Home Skill (virtual contact sensor) and the proactive event reporter in the Node backend.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 11.1 | Create `lambda/alexa-smart-home/` — Lambda handler for Discovery + AcceptGrant + StateReport directives | ⏳ | Returns virtual "Garden Alert Sensor" contact sensor |
| 11.2 | Create `lambda/alexa-smart-home/package.json` + build script | ⏳ | [PARALLEL with 11.1] |
| 11.3 | Create `src/alexaNotifier.ts` — send ChangeReport to Alexa Event Gateway (proactive state reporting) | ⏳ | |
| 11.4 | Implement LWA (Login with Amazon) OAuth2 token management in `src/alexaAuth.ts` — token fetch + auto-refresh | ⏳ | [PARALLEL with 11.3] |
| 11.5 | Add Alexa env vars to `.env.example` | ⏳ | |
| 11.6 | Wire Alexa notification into `index.ts` — fire in parallel with Telegram + Twilio | ⏳ | |

---

## GROUP 12: Notification Channel Config & Dashboard Updates
**Depends on:** GROUP 10, GROUP 11
**Summary:** Add per-rule notification channel selection, update dashboard UI, and update all docs.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 12.1 | Update `Rule` type in `types.ts` — add `notificationChannels: ('telegram' \| 'twilio' \| 'alexa')[]` field | ⏳ | |
| 12.2 | Create `src/notificationDispatcher.ts` — unified dispatcher that fires enabled channels per rule in parallel | ⏳ | |
| 12.3 | Refactor `index.ts` to use dispatcher instead of direct `sendTelegramNotification` call | ⏳ | |
| 12.4 | Update `RuleModal.tsx` — add channel checkboxes (Telegram, Phone Call, Alexa) | ⏳ | |
| 12.5 | Update dashboard `Settings.tsx` — add Alexa config section | ⏳ | |
| 12.6 | Update `config/rules.json` seed data with `notificationChannels` field | ⏳ | |
| 12.7 | Update `architecture.md` — add notification channels to system diagram | ⏳ | |
| 12.8 | Update `README.md` — Twilio + Alexa setup instructions | ⏳ | |

---

## GROUP 13: Alexa Skill Setup Guide & Routine Config
**Depends on:** GROUP 11
**Summary:** Step-by-step guide for creating the Alexa Skill in Amazon Developer Console, deploying Lambda, account linking, and configuring the Alexa Routine.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 13.1 | Create `docs/user/alexa-setup-guide.md` — full walkthrough: Developer Console → Skill creation → Lambda deploy → Account linking → Device discovery → Routine setup | ⏳ | |
| 13.2 | Create `docs/user/twilio-setup-guide.md` — account creation, phone number, verified caller IDs, env config | ⏳ | [PARALLEL with 13.1] |

---

## GROUP 14: CLI Network Subnet Validation & Auto-Fix ✅
**Depends on:** GROUP 8
**Summary:** Detect when Mac is on a different subnet than the DVR and auto-fix via DHCP before falling back to static IP assignment.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 14.1 | Add subnet mismatch detection to `network.ts` — compare host IP subnet with DVR IP subnet from frigate.yml, flag mismatch | ✅ | `isSameSubnet()` helper |
| 14.2 | Add DHCP auto-fix in `network.ts` — if subnet mismatch or self-assigned IP, run `networksetup -setdhcp Wi-Fi` (sudo prompt), wait for new IP, then re-validate | ✅ | `switchToDHCPAndWait()` — polls up to 10s |
| 14.3 | Wire subnet check into `ensureNetwork()` flow — run before DVR reachability, show clear pass/fail status, re-validate after fix | ✅ | DHCP → static fallback on DVR subnet |

---

## GROUP 15: IST Timezone Fix ✅
**Depends on:** GROUP 2, GROUP 5
**Summary:** Ensure all timestamps (Telegram notifications, dashboard events, logs) display in IST (Asia/Kolkata).

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 15.1 | Fix `notifier.ts` — use `Asia/Kolkata` timezone in `toLocaleString` | ✅ | |
| 15.2 | Fix `twilioNotifier.ts` — use `Asia/Kolkata` timezone | ✅ | [PARALLEL with 15.1] |
| 15.3 | Fix dashboard `EventsLog.tsx` / `EventTable.tsx` — render timestamps in IST | ✅ | Replaced date-fns with explicit IST toLocaleString + TZ on Docker |

---

## GROUP 16: CLI Twilio Config Prompts ✅
**Depends on:** GROUP 10
**Summary:** Add Twilio credential prompts to CLI first-run and reconfigure flows so users are asked during installation.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 16.1 | Update `twilioNotifier.ts` to support comma-separated `TWILIO_TO_NUMBER` — call all numbers in parallel | ✅ | Promise.all across all numbers |
| 16.2 | Add Twilio prompts (Account SID, Auth Token, From Number, To Numbers) to `config.ts` — optional, skippable | ✅ | Confirm gate + validation |
| 16.3 | Write Twilio env vars to `.env` in `writeEnvFile()` | ✅ | |
| 16.4 | Bump CLI version in `package.json` | ✅ | 1.1.9 → 1.2.0 |
