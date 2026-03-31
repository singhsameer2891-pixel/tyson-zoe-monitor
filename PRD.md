# Home CCTV Intelligence System — PRD
> **For Claude Code** | Local Laptop Deployment (Test Phase)

---

## 1. Overview

Build a lightweight home CCTV intelligence layer that sits on top of an existing DVR/NVR setup. The system pulls RTSP streams from existing cameras, runs object detection, evaluates zone-based rules, and pushes notifications to the homeowner's phone.

**Primary Goals:**
- Detect when dogs enter a predefined garden zone → notify, ignore humans in that zone
- Detect when any person crosses a boundary perimeter during nighttime hours → notify as intrusion alert

**Deployment:** Single laptop (local), Docker-based, no cloud dependency for test phase.

---

## 2. User Stories

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-01 | Homeowner | Define a garden zone on a camera feed | I can set a virtual perimeter |
| US-02 | Homeowner | Get notified when my dog enters the garden zone | I know where my dog is |
| US-03 | Homeowner | NOT get notified when a human enters the garden zone | I don't get spammed during normal activity |
| US-04 | Homeowner | Define nighttime hours (e.g. 11 PM – 6 AM) | The system knows when to be alert for intrusion |
| US-05 | Homeowner | Get notified when any person crosses the boundary during nighttime | I'm alerted to potential intrusion |
| US-06 | Homeowner | See a snapshot of the detection event in my notification | I can visually verify without opening an app |
| US-07 | Homeowner | View recent detection events in a simple dashboard | I have a log of what happened |
| US-08 | Homeowner | Add/edit camera RTSP URLs and zones | I can configure without touching code |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────┐
│                  LOCAL LAPTOP                   │
│                                                 │
│  ┌──────────┐    RTSP     ┌──────────────────┐  │
│  │  DVR/NVR │────────────▶│  Frigate NVR     │  │
│  │ (existing│             │  (Docker)        │  │
│  │  hardware│             │  - Zone config   │  │
│  └──────────┘             │  - Object detect │  │
│                           │  - MQTT events   │  │
│                           └────────┬─────────┘  │
│                                    │ MQTT        │
│                           ┌────────▼─────────┐  │
│                           │  Automation      │  │
│                           │  Service (Node)  │  │
│                           │  - Rule engine   │  │
│                           │  - Time checks   │  │
│                           │  - Notif. logic  │  │
│                           └────────┬─────────┘  │
│                                    │             │
│                      ┌─────────────▼──────────┐ │
│                      │   Notification Service  │ │
│                      │   Telegram Bot / Pushover│ │
│                      └─────────────────────────┘ │
│                                    │             │
│                           ┌────────▼─────────┐  │
│                           │  Dashboard UI    │  │
│                           │  (React, port    │  │
│                           │   3000)          │  │
│                           └──────────────────┘  │
└─────────────────────────────────────────────────┘
                                    │
                             ┌──────▼──────┐
                             │  Phone       │
                             │  (Telegram / │
                             │  Pushover)   │
                             └─────────────┘
```

---

## 4. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Container orchestration | **Docker Compose** | Single command startup, easy teardown |
| Camera / Object Detection | **Frigate NVR** | Purpose-built, RTSP native, zone support, MQTT events |
| Detection Model | **YOLOv8n** (via Frigate) | Person + dog detection out of the box |
| Message Bus | **Mosquitto MQTT** (Docker) | Frigate publishes events here natively |
| Automation Engine | **Node.js + TypeScript** | Custom rule engine, lightweight |
| Notification | **Telegram Bot API** | Free, reliable, image-in-notification support |
| Dashboard | **React + Vite + TailwindCSS** | Fast to build, easy to run locally |
| Config Storage | **JSON file** (file-based) | Simple for test phase, no DB overhead |
| Event Log Storage | **SQLite** (via better-sqlite3) | Lightweight, file-based, no server needed |

---

## 5. Component Breakdown

### 5.1 Docker Compose Services

**File: `docker-compose.yml`**

Define the following services:
```
services:
  - mosquitto       # MQTT broker
  - frigate         # Camera + detection
  - automation      # Node.js rule engine (built from local Dockerfile)
  - dashboard       # React app (built from local Dockerfile)
```

All services on a shared Docker network (`cctv-net`).

Volumes:
- `./config/frigate.yml` → Frigate config
- `./config/mosquitto.conf` → MQTT config
- `./config/rules.json` → Automation rules
- `./data/events.db` → SQLite event log
- `./media/clips/` → Frigate snapshot storage

---

### 5.2 Frigate Configuration

**File: `config/frigate.yml`**

Must be templated with placeholders the user fills in. Structure:

```yaml
mqtt:
  host: mosquitto
  port: 1883

cameras:
  camera_garden:
    ffmpeg:
      inputs:
        - path: rtsp://<USER_FILLS_IN>
          roles: [detect, record]
    detect:
      width: 1280
      height: 720
      fps: 5
    objects:
      track: [person, dog]
    zones:
      garden_zone:
        coordinates: <POLYGON_COORDS>   # filled via dashboard
        objects:
          - dog
          - person

  camera_entrance:
    ffmpeg:
      inputs:
        - path: rtsp://<USER_FILLS_IN>
          roles: [detect, record]
    detect:
      width: 1280
      height: 720
      fps: 5
    objects:
      track: [person]
    zones:
      boundary_zone:
        coordinates: <POLYGON_COORDS>
        objects:
          - person

record:
  enabled: true
  retain:
    days: 7
  events:
    retain:
      default: 14

snapshots:
  enabled: true
  bounding_box: true
  retain:
    default: 14
```

---

### 5.3 Automation Service (Node.js + TypeScript)

**Directory: `services/automation/`**

#### Responsibilities:
1. Subscribe to Frigate MQTT topics
2. Evaluate events against rules from `rules.json`
3. Send Telegram notifications with snapshot images
4. Log events to SQLite

#### MQTT Topics to Subscribe:
```
frigate/events          → New detection events (object entered/left zone)
frigate/+/person/+      → Person-specific events
frigate/+/dog/+         → Dog-specific events
```

#### Rule Engine Logic:

```typescript
interface Rule {
  id: string;
  name: string;
  camera: string;
  zone: string;
  objectType: "dog" | "person" | "cat";
  action: "entered" | "exited";
  timeRestriction?: {
    enabled: boolean;
    startHour: number;   // 23 for 11 PM
    endHour: number;     // 6 for 6 AM
  };
  notificationTemplate: string;
  enabled: boolean;
}
```

Default rules to seed:
```json
[
  {
    "id": "rule-dog-garden",
    "name": "Dog in Garden",
    "camera": "camera_garden",
    "zone": "garden_zone",
    "objectType": "dog",
    "action": "entered",
    "timeRestriction": { "enabled": false },
    "notificationTemplate": "🐕 Dog spotted in the garden!",
    "enabled": true
  },
  {
    "id": "rule-intruder-night",
    "name": "Nighttime Boundary Breach",
    "camera": "camera_entrance",
    "zone": "boundary_zone",
    "objectType": "person",
    "action": "entered",
    "timeRestriction": {
      "enabled": true,
      "startHour": 23,
      "endHour": 6
    },
    "notificationTemplate": "⚠️ Person detected at entrance boundary!",
    "enabled": true
  }
]
```

#### Key Functions:

```
evaluateEvent(mqttPayload) → boolean (should notify?)
isWithinTimeRestriction(rule) → boolean
fetchSnapshot(cameraId, eventId) → Buffer (image)
sendTelegramNotification(text, imageBuffer) → void
logEvent(event, ruleMatched, notified) → void
```

#### File Structure:
```
services/automation/
├── src/
│   ├── index.ts           # Entry, MQTT connection
│   ├── ruleEngine.ts      # Rule evaluation logic
│   ├── notifier.ts        # Telegram integration
│   ├── eventLogger.ts     # SQLite logging
│   └── types.ts           # Shared interfaces
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

### 5.4 Notification Service (Telegram)

**Integration: Telegram Bot API**

Setup steps (document in README):
1. Create bot via `@BotFather` → get `BOT_TOKEN`
2. Start a chat with the bot → get `CHAT_ID`
3. Set both in `.env`

Notification format:
```
[Image snapshot attached]

🐕 Dog spotted in the garden!
📷 Camera: Garden (South)
🕐 Time: 9:45 PM, 31 Mar 2026
📍 Zone: garden_zone
```

For intruder alerts:
```
[Image snapshot attached]

⚠️ ALERT: Person at boundary
📷 Camera: Entrance
🕐 Time: 1:23 AM, 31 Mar 2026
📍 Zone: boundary_zone
```

Use `sendPhoto` API method (not `sendMessage`) so image is inline.

**Rate limiting:** Max 1 notification per rule per 60 seconds to prevent spam. Configurable in `.env`.

---

### 5.5 Dashboard (React + Vite)

**Directory: `dashboard/`**

#### Pages / Views:

**1. Live Feed View (`/live`)**
- Embed Frigate's built-in stream via iframe (`http://localhost:5000`)
- Camera selector dropdown
- Current zone overlays (display only in test phase)

**2. Events Log (`/events`)**
- Table: Timestamp | Camera | Zone | Object | Rule Triggered | Snapshot thumbnail
- Filter by: camera, object type, date range
- Click row → expand snapshot full size
- Data source: GET `/api/events` from automation service

**3. Rules Config (`/rules`)**
- List of current rules from `rules.json`
- Toggle enable/disable per rule
- Edit modal:
  - Rule name
  - Camera selector (dropdown from config)
  - Zone name (text input, must match Frigate zone name)
  - Object type (dog / person / cat)
  - Action (entered / exited)
  - Time restriction toggle + hour pickers
  - Notification template text
- Save → writes back to `rules.json` via POST `/api/rules`

**4. Settings (`/settings`)**
- Telegram Bot Token (masked input)
- Telegram Chat ID
- Notification cooldown (seconds)
- Save → writes to `.env` equivalent config file

#### Dashboard API (served by automation service):

```
GET  /api/events?limit=50&camera=&object=&from=&to=
GET  /api/rules
POST /api/rules           → save full rules array
GET  /api/cameras         → list cameras from frigate.yml
GET  /api/health          → system health (frigate up?, mqtt connected?)
GET  /api/snapshot/:eventId → proxy snapshot from Frigate
```

---

## 6. File & Folder Structure

```
home-cctv-intelligence/
├── docker-compose.yml
├── .env.example
├── .env                          # gitignored
├── README.md
│
├── config/
│   ├── frigate.yml               # Frigate camera + zone config
│   └── mosquitto.conf            # MQTT broker config
│
├── data/
│   └── events.db                 # SQLite (auto-created)
│
├── media/
│   └── clips/                    # Frigate snapshots (auto-populated)
│
├── services/
│   └── automation/
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── ruleEngine.ts
│           ├── notifier.ts
│           ├── eventLogger.ts
│           ├── apiServer.ts      # Express REST API for dashboard
│           └── types.ts
│
└── dashboard/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── pages/
        │   ├── LiveFeed.tsx
        │   ├── EventsLog.tsx
        │   ├── RulesConfig.tsx
        │   └── Settings.tsx
        └── components/
            ├── Layout.tsx
            ├── EventTable.tsx
            ├── RuleModal.tsx
            └── SnapshotCard.tsx
```

---

## 7. Environment Variables

**File: `.env.example`**

```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Notification
NOTIFICATION_COOLDOWN_SECONDS=60

# Frigate
FRIGATE_API_URL=http://frigate:5000

# MQTT
MQTT_HOST=mosquitto
MQTT_PORT=1883

# API
API_PORT=4000

# Dashboard
VITE_API_URL=http://localhost:4000
```

---

## 8. Setup & Installation Tasks for Claude Code

### Phase 1 — Scaffold

- [ ] Create root project folder structure as defined in Section 6
- [ ] Create `docker-compose.yml` with all 4 services
- [ ] Create `config/mosquitto.conf` (basic broker, no auth for local)
- [ ] Create `.env.example`
- [ ] Create `.gitignore` (exclude `.env`, `data/`, `media/`)

### Phase 2 — Automation Service

- [ ] Init Node.js + TypeScript project in `services/automation/`
- [ ] Install deps: `mqtt`, `axios`, `better-sqlite3`, `express`, `dotenv`, `node-telegram-bot-api`
- [ ] Implement `types.ts` — all shared interfaces
- [ ] Implement `eventLogger.ts` — SQLite schema creation + insert/query functions
- [ ] Implement `ruleEngine.ts` — rule evaluation + time restriction logic
- [ ] Implement `notifier.ts` — Telegram `sendPhoto` with caption
- [ ] Implement `index.ts` — MQTT connect, subscribe to `frigate/events`, wire together
- [ ] Implement `apiServer.ts` — Express server with all `/api/` routes
- [ ] Create `Dockerfile` for automation service
- [ ] Seed default `config/rules.json`

### Phase 3 — Dashboard

- [ ] Init React + Vite + TypeScript + TailwindCSS in `dashboard/`
- [ ] Install deps: `react-router-dom`, `axios`, `date-fns`, `lucide-react`
- [ ] Build `Layout.tsx` — sidebar nav (Live / Events / Rules / Settings)
- [ ] Build `EventsLog.tsx` — table with filters, snapshot thumbnails
- [ ] Build `RulesConfig.tsx` — rules list + edit modal
- [ ] Build `Settings.tsx` — env config form
- [ ] Build `LiveFeed.tsx` — Frigate iframe embed + camera selector
- [ ] Create `Dockerfile` for dashboard
- [ ] Wire all API calls via `axios` to `VITE_API_URL`

### Phase 4 — Frigate Config

- [ ] Create `config/frigate.yml` with placeholder `<RTSP_URL>` and `<ZONE_COORDS>` markers
- [ ] Add clear inline comments explaining how to fill each value
- [ ] Document in README: how to get RTSP URL from common DVR brands (Hikvision, Dahua, CP Plus)

### Phase 5 — README

- [ ] Write `README.md` covering:
  - Prerequisites (Docker, Docker Compose)
  - Step 1: Clone + copy `.env.example` to `.env`
  - Step 2: Fill RTSP URLs in `frigate.yml`
  - Step 3: Create Telegram bot + fill `.env`
  - Step 4: `docker compose up -d`
  - Step 5: Open dashboard at `http://localhost:3000`
  - Step 6: How to get zone polygon coordinates from Frigate UI
  - Troubleshooting section

---

## 9. Out of Scope (Test Phase)

- Zone drawing UI (drag polygon on live feed) — user will get coords from Frigate's built-in debug view
- Google Coral / GPU acceleration
- Multi-user / auth on dashboard
- Cloud sync or remote access
- Pushover / other notification channels
- Fine-tuning model for specific dog breeds
- Home Assistant integration

---

## 10. Success Criteria

| Criteria | Pass Condition |
|---|---|
| Dog detection fires notification | Telegram message received with snapshot within 10s of dog entering zone |
| Human in garden zone — no notification | No Telegram message when a person walks through garden zone |
| Night boundary breach fires notification | Telegram alert received when person crosses boundary between configured hours |
| Daytime boundary — no notification | No alert when person crosses boundary outside nighttime window |
| Events log populated | Dashboard shows last 50 events with correct metadata |
| System survives restart | `docker compose up` brings everything back, no data loss |
| Cooldown works | Second detection within 60s does not fire duplicate notification |

---

## 11. Known Constraints & Notes

- **RTSP stream must be accessible from the laptop** — same network as DVR/NVR
- **YOLOv8 dog detection** works well in daylight; IR night vision feeds may reduce accuracy for dogs specifically (person detection remains good)
- **Frigate's zone system** uses normalized polygon coordinates — user must use Frigate's debug view at `http://localhost:5000` to draw and copy zone coordinates, then paste into `frigate.yml`
- **No GPU on laptop** — Frigate will use CPU inference; expect 1–2 second detection latency at 5 FPS. Acceptable for test phase.
- **Snapshot availability** — Frigate takes ~2s to write snapshot post-detection; automation service should add a 2.5s delay before fetching snapshot

---

*PRD Version: 1.0 | Phase: Local Test | Owner: Sam*
