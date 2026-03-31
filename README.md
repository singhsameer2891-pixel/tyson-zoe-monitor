# Tyson & Zoe Monitor

Home CCTV intelligence layer for dog monitoring and nighttime intrusion detection. Runs locally on a single machine via Docker — no cloud dependency.

**What it does:**
- Detects when your dogs enter a garden zone → sends Telegram notification with snapshot
- Detects nighttime boundary breach by a person → sends Telegram alert with snapshot
- Logs all detection events to a searchable dashboard

---

## Architecture

```
DVR/NVR (existing) ──RTSP──▶ Frigate NVR ──MQTT──▶ Automation Service ──▶ Telegram
                              (detection)           (rules + notify)       (phone)
                                  ▲                       │
                                  │                  REST API (:4000)
                                  │                       │
                              Browser ◀──── Dashboard (:3000) ──────────────┘
                           (Frigate UI)     (events, rules, live feed)
```

| Service | Port | Description |
|---|---|---|
| Mosquitto | 1883 | MQTT broker (Frigate → Automation) |
| Frigate | 5000 | Camera streams, object detection, zone management |
| Automation | 4000 | Rule engine, Telegram notifier, event log, REST API |
| Dashboard | 3000 | React UI — events log, rules config, live feed, settings |

---

## Prerequisites

- **Docker** and **Docker Compose** (v2)
- Camera(s) accessible via RTSP on the same network
- A Telegram bot (see Step 3)

---

## Setup

### Step 1 — Clone & configure environment

```bash
git clone <repo-url> && cd tyson_zoe_monitor
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
NOTIFICATION_COOLDOWN_SECONDS=60
HOST_IP=192.168.1.x   # your machine's LAN IP
```

### Step 2 — Configure camera RTSP URLs

Edit `config/frigate.yml` and replace the placeholder URLs:

```yaml
# Garden camera
- path: rtsp://<RTSP_URL_GARDEN>

# Entrance camera
- path: rtsp://<RTSP_URL_ENTRANCE>
```

**Common RTSP URL formats:**

| Brand | Format |
|---|---|
| Hikvision | `rtsp://user:pass@IP:554/Streaming/Channels/101` |
| Dahua | `rtsp://user:pass@IP:554/cam/realmonitor?channel=1&subtype=0` |
| CP Plus | `rtsp://user:pass@IP:554/cam/realmonitor?channel=1&subtype=1` |
| Generic ONVIF | `rtsp://user:pass@IP:554/stream1` |

**Tips for finding your RTSP URL:**
1. Check your DVR/NVR's network settings for the RTSP port (usually 554)
2. Try VLC: Media → Open Network Stream → paste the URL to test
3. Use ONVIF Device Manager (Windows) to auto-discover camera URLs
4. Main stream = high quality (subtype=0), sub stream = lower quality (subtype=1) — use sub stream for detection to reduce CPU load

### Step 3 — Create a Telegram bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` → follow prompts → copy the **Bot Token**
3. Start a chat with your new bot (send any message)
4. Get your Chat ID: visit `https://api.telegram.org/bot<TOKEN>/getUpdates` → find `chat.id` in the response
5. Paste both values into `.env`

### Step 4 — Start everything

```bash
docker compose up -d
```

Wait ~30 seconds for all services to initialize. Check status:

```bash
docker compose ps        # all 4 services should be "running"
docker compose logs -f   # watch live logs (Ctrl+C to exit)
```

### Step 5 — Open the dashboard

- **Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Frigate UI:** [http://localhost:5000](http://localhost:5000)

### Step 6 — Configure zone coordinates

Zones determine where detection events trigger rules. You must set zone coordinates in `config/frigate.yml`.

1. Open Frigate UI at `http://localhost:5000`
2. Go to the camera's debug view
3. Draw a zone polygon on the feed — Frigate shows normalized coordinates (0.0–1.0)
4. Copy the coordinates and paste into `config/frigate.yml`:

```yaml
zones:
  garden_zone:
    coordinates: 0.1,0.2,0.4,0.2,0.4,0.8,0.1,0.8
```

5. Restart Frigate to apply:

```bash
docker compose restart frigate
```

---

## Default Rules

The system ships with two pre-configured rules in `config/rules.json`:

| Rule | Camera | Zone | Object | Time Restriction |
|---|---|---|---|---|
| Dog in Garden | camera_garden | garden_zone | dog | None (24/7) |
| Nighttime Boundary Breach | camera_entrance | boundary_zone | person | 11 PM – 6 AM |

Edit rules via the Dashboard at `/rules`, or directly in `config/rules.json`.

---

## Dashboard Pages

| Page | Path | Description |
|---|---|---|
| Events Log | `/events` | Filterable table of detection events with snapshot thumbnails |
| Rules Config | `/rules` | Toggle, edit, delete, and add detection rules |
| Live Feed | `/live` | Frigate camera stream via iframe with camera selector |
| Settings | `/settings` | Telegram config, cooldown settings, system health |

---

## API Endpoints

The automation service exposes a REST API on port 4000:

| Method | Path | Description |
|---|---|---|
| GET | `/api/events?limit=50&camera=&object=&from=&to=` | Query logged events |
| GET | `/api/rules` | Get current rules |
| POST | `/api/rules` | Save full rules array |
| GET | `/api/cameras` | List cameras from Frigate config |
| GET | `/api/health` | System health (MQTT, Frigate, uptime) |
| GET | `/api/snapshot/:eventId` | Proxy snapshot image from Frigate |

---

## Troubleshooting

### Frigate won't start / no video feed

- Verify RTSP URL works in VLC first
- Check camera is on the same network as the laptop
- Review logs: `docker compose logs frigate`
- Ensure `shm_size: 256mb` is set (already configured in docker-compose)

### No Telegram notifications

- Verify bot token and chat ID in `.env`
- Ensure you've sent at least one message to the bot (it can't initiate chats)
- Check automation logs: `docker compose logs automation`
- Confirm rules are enabled: `curl http://localhost:4000/api/rules`

### Dashboard can't connect to API

- The dashboard proxies `/api/` requests to the automation service via nginx
- Check automation is running: `docker compose ps automation`
- For local dev (non-Docker), set `VITE_API_URL=http://localhost:4000` in dashboard's env

### Events not appearing in dashboard

- Frigate must detect an object in a zone that matches a rule
- Check MQTT connectivity: `docker compose logs automation | grep mqtt`
- Test with: `curl http://localhost:4000/api/health`

### High CPU usage

- Frigate runs YOLOv8n on CPU — expect moderate CPU usage at 5 FPS per camera
- Use sub-stream RTSP URLs (lower resolution) to reduce load
- Reduce `fps` in `config/frigate.yml` from 5 to 3

### Duplicate notifications

- Rate limiting is built in: max 1 notification per rule per 60s (configurable via `NOTIFICATION_COOLDOWN_SECONDS`)
- Event deduplication also prevents re-processing the same event

---

## Stopping & Restarting

```bash
docker compose down      # stop all services
docker compose up -d     # restart (data persists in ./data/ and ./media/)
```

All event data (SQLite) and media clips survive restarts.

---

## Project Structure

```
tyson_zoe_monitor/
├── docker-compose.yml          # 4 services on cctv-net
├── .env.example                # Environment template
├── config/
│   ├── frigate.yml             # Camera + zone config (edit this)
│   ├── mosquitto.conf          # MQTT broker config
│   └── rules.json              # Detection rules
├── data/
│   └── events.db               # SQLite event log (auto-created)
├── media/
│   └── clips/                  # Frigate snapshots
├── services/
│   └── automation/             # Node.js + TS automation service
│       └── src/
│           ├── index.ts        # Entry point, MQTT connection
│           ├── ruleEngine.ts   # Rule evaluation + time checks
│           ├── notifier.ts     # Telegram notifications
│           ├── eventLogger.ts  # SQLite event logging
│           ├── apiServer.ts    # Express REST API
│           └── types.ts        # Shared interfaces
└── dashboard/                  # React + Vite + Tailwind dashboard
    └── src/
        ├── App.tsx             # Router setup
        ├── pages/              # EventsLog, RulesConfig, LiveFeed, Settings
        └── components/         # Layout, EventTable, RuleModal, SnapshotCard
```

---

*Built for local deployment. No cloud. No subscriptions. Just your cameras, your rules, your alerts.*
