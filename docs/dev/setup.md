# Developer Setup — Tyson & Zoe Monitor

> Run the automation service and dashboard locally without Docker for development and debugging.

---

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 20+ | `node --version` |
| npm | 9+ | `npm --version` |
| Mosquitto | Any (for local MQTT) | `mosquitto -h` |

You'll also need a running Frigate instance (Docker or native) for detection events and snapshots.

---

## 1. Clone & Environment Setup

```bash
git clone <repo-url> && cd tyson_zoe_monitor
cp .env.example .env
```

Edit `.env` for local dev:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
NOTIFICATION_COOLDOWN_SECONDS=60
FRIGATE_API_URL=http://localhost:5000
MQTT_HOST=localhost
MQTT_PORT=1883
API_PORT=4000
VITE_API_URL=http://localhost:4000
HOST_IP=localhost
```

---

## 2. Start MQTT Broker

Option A — Docker (recommended):

```bash
docker run -d --name mosquitto -p 1883:1883 eclipse-mosquitto:2
```

Option B — Native (macOS):

```bash
brew install mosquitto
mosquitto -c config/mosquitto.conf
```

---

## 3. Start Frigate

Frigate runs as a Docker container even in dev mode:

```bash
docker run -d \
  --name frigate \
  -p 5000:5000 \
  -p 8554:8554 \
  --shm-size=256mb \
  -v $(pwd)/config/frigate.yml:/config/config.yml \
  -v $(pwd)/media/clips:/media/frigate/clips \
  ghcr.io/blakeblackshear/frigate:stable
```

Make sure `config/frigate.yml` has valid RTSP URLs before starting.

---

## 4. Automation Service

```bash
cd services/automation
npm install
```

### Run in dev mode (ts-node):

```bash
npm run dev
```

### Build and run compiled:

```bash
npm run build
npm start
```

The service will:
- Connect to MQTT at `localhost:1883`
- Start REST API at `http://localhost:4000`
- Use `config/rules.json` for rules (path: `RULES_PATH` env var)
- Store events in SQLite at `data/events.db` (path: `DB_PATH` env var)

**Dev env vars for automation** (override defaults for local paths):

```bash
RULES_PATH=../../config/rules.json
DB_PATH=../../data/events.db
FRIGATE_CONFIG_PATH=../../config/frigate.yml
```

Or create a local `.env` inside `services/automation/` with these values.

---

## 5. Dashboard

```bash
cd dashboard
npm install
```

### Run dev server:

```bash
npm run dev
```

Opens at `http://localhost:5173` (Vite default). API calls go to `VITE_API_URL` (set in `.env` or `dashboard/.env`).

### Build for production:

```bash
npm run build
npm run preview    # preview the build at http://localhost:4173
```

**Stack:**
- React 19 + TypeScript
- Vite 8 + @tailwindcss/vite (Tailwind v4)
- React Router v7
- Axios for API calls
- lucide-react for icons

---

## 6. Project Structure Quick Reference

```
services/automation/src/
├── index.ts          # Entry: MQTT connect, event handling, orchestration
├── ruleEngine.ts     # Rule loading, evaluation, time restriction, cooldown
├── notifier.ts       # Telegram sendPhoto with snapshot (2.5s delay)
├── eventLogger.ts    # SQLite init, insert, query (WAL mode)
├── apiServer.ts      # Express REST API (6 endpoints)
└── types.ts          # Rule, FrigateEvent, EventLogEntry interfaces

dashboard/src/
├── App.tsx           # React Router config (4 routes)
├── pages/
│   ├── EventsLog.tsx     # Events table with filters
│   ├── RulesConfig.tsx   # Rule list with toggle/edit/delete
│   ├── LiveFeed.tsx      # Frigate iframe + camera selector
│   └── Settings.tsx      # Telegram config + health status
└── components/
    ├── Layout.tsx        # Sidebar nav (dark theme, emerald accent)
    ├── EventTable.tsx    # Event rows with snapshot thumbnails
    ├── RuleModal.tsx     # Rule edit form modal
    └── SnapshotCard.tsx  # Click-to-expand snapshot
```

---

## 7. Testing MQTT Events Manually

Publish a fake Frigate event to test the pipeline without a camera:

```bash
mosquitto_pub -h localhost -t "frigate/events" -m '{
  "type": "new",
  "after": {
    "id": "test-event-001",
    "camera": "camera_garden",
    "label": "dog",
    "current_zones": ["garden_zone"],
    "entered_zones": ["garden_zone"],
    "top_score": 0.85,
    "has_snapshot": true,
    "has_clip": false,
    "start_time": 1711843200,
    "end_time": null
  },
  "before": {
    "id": "test-event-001",
    "camera": "camera_garden",
    "label": "dog",
    "current_zones": [],
    "entered_zones": [],
    "top_score": 0.85,
    "has_snapshot": false,
    "has_clip": false,
    "start_time": 1711843200,
    "end_time": null
  }
}'
```

Check automation logs for `[rule] Match: "Dog in Garden"` output.

---

## 8. Useful Commands

| Command | Purpose |
|---|---|
| `docker compose logs -f automation` | Watch automation service logs |
| `curl http://localhost:4000/api/health` | Check service health |
| `curl http://localhost:4000/api/events?limit=5` | Query recent events |
| `curl http://localhost:4000/api/rules` | View current rules |
| `curl http://localhost:4000/api/cameras` | List configured cameras |
| `sqlite3 data/events.db "SELECT * FROM events ORDER BY id DESC LIMIT 5;"` | Query events DB directly |

---

*Last updated: 2026-03-31*
