# Setup & Usage — Tyson & Zoe Monitor

## Quick Start (fresh machine)

```bash
git clone https://github.com/singhsameer2891-pixel/tyson-zoe-monitor.git
cd tyson-zoe-monitor
cp .env.example .env
```

Edit `.env` with your values:

```env
TELEGRAM_BOT_TOKEN=8625097684:AAF1dWnh6mP4D-tsih86wJ6-GP7czWoGf9U
TELEGRAM_CHAT_ID=-1003764007243
HOST_IP=<your machine's LAN IP>
```

Get your LAN IP:
```bash
ipconfig getifaddr en0    # macOS
```

Start everything:
```bash
docker compose up -d
```

## URLs

| Service | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| Frigate UI | http://localhost:5001 |
| Automation API | http://localhost:4000 |

## DVR Details

| Field | Value |
|---|---|
| Model | CP Plus CP-UNR-108F1 (8-ch NVR) |
| IP | 192.168.31.245 |
| RTSP User | frigate |
| RTSP Password | Frigate1! |
| RTSP Port | 554 |
| Admin User | admin |
| Admin Password | admin@123 |

## Camera Mapping

| Frigate Name | DVR Channel | View | Purpose |
|---|---|---|---|
| camera_garden | 5 | Side wall, water tank, grass strip | Boundary / nighttime intrusion |
| camera_entrance | 4 | Backyard patio, plants, artificial grass | Garden — Tyson & Zoe monitoring |

## Zone Configuration

Zones are configured via Frigate UI: http://localhost:5001/settings → Masks / Zones

| Zone | Camera | Objects | Purpose |
|---|---|---|---|
| backyard_garden | camera_entrance | dog, person | Dog enters garden → Telegram alert |
| garden_zone | camera_garden | dog, person | Boundary area monitoring |

To edit zones: select the zone → drag polygon points → save.

## Telegram Setup

- Bot: @TysonZoeMonitor_bot
- Group: "Tyson Zoe monitor" (Sam + father)
- Group chat ID: -1003764007243
- Bot privacy: Disabled (so it can send to groups)

To add more people: add them to the Telegram group. Everyone in the group gets alerts.

## Daily Usage

**Start (after laptop reboot):**
```bash
cd tyson-zoe-monitor
docker compose up -d
```

**Stop:**
```bash
docker compose down
```

**Check status:**
```bash
docker compose ps
curl http://localhost:4000/api/health
```

**View logs:**
```bash
docker compose logs -f automation    # detection + notification logs
docker compose logs -f frigate       # camera + detection logs
```

**View recent events:**
```bash
curl http://localhost:4000/api/events?limit=10
```

## Rules

Managed via dashboard (http://localhost:3000/rules) or directly in `config/rules.json`:

| Rule | Camera | Zone | Object | Time | Status |
|---|---|---|---|---|---|
| Dog in Garden | camera_entrance | backyard_garden | dog | 24/7 | Enabled |
| Person in Garden | camera_entrance | backyard_garden | person | 24/7 | Enabled |
| Nighttime Boundary | camera_garden | garden_zone | person | 11 PM – 6 AM | Enabled |

## Notification Behavior

- Cooldown: 60 seconds per rule (configurable in `.env`)
- On failure: retries every 5 seconds for up to 5 minutes
- Cooldown only starts after successful delivery
- Snapshot: live camera frame at the moment of zone entry

## Troubleshooting

| Problem | Fix |
|---|---|
| No notifications after laptop restart | Run `docker compose up -d` |
| Notifications go to personal chat, not group | Recreate container: `docker compose up -d --force-recreate automation` |
| Cameras not streaming | Check DVR is on and at 192.168.31.245 |
| Detection not working | Check `detect: enabled: true` in `config/frigate.yml` |
| Dog not detected | Ensure `track: [person, dog]` in camera's objects config |
