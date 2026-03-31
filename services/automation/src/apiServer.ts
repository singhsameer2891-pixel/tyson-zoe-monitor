import express, { Request, Response } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import axios from "axios";
import { getEvents, EventQuery } from "./eventLogger";
import { loadRules, saveRules } from "./ruleEngine";
import { isMqttConnected, startTime } from "./index";
import { runDiagnostics } from "./diagnostics";

const FRIGATE_API_URL = process.env.FRIGATE_API_URL || "http://frigate:5000";
const FRIGATE_CONFIG_PATH =
  process.env.FRIGATE_CONFIG_PATH || "/config/config.yml";
const API_PORT = parseInt(process.env.API_PORT || "4000", 10);

const app = express();
app.use(cors());
app.use(express.json());

// GET /api/events — query logged events
app.get("/api/events", (req: Request, res: Response) => {
  const query: EventQuery = {
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    camera: req.query.camera as string | undefined,
    object_type: req.query.object as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
  };

  const events = getEvents(query);
  res.json(events);
});

// GET /api/rules — return current rules
app.get("/api/rules", (_req: Request, res: Response) => {
  const rules = loadRules();
  res.json(rules);
});

// POST /api/rules — save full rules array
app.post("/api/rules", (req: Request, res: Response) => {
  const rules = req.body;
  if (!Array.isArray(rules)) {
    res.status(400).json({ error: "Body must be an array of rules" });
    return;
  }
  saveRules(rules);
  res.json({ ok: true, count: rules.length });
});

// GET /api/cameras — list cameras from frigate config
app.get("/api/cameras", (_req: Request, res: Response) => {
  try {
    const raw = fs.readFileSync(FRIGATE_CONFIG_PATH, "utf-8");
    // Parse camera names from YAML — simple regex extraction
    const cameraNames: string[] = [];
    const lines = raw.split("\n");
    let inCameras = false;
    for (const line of lines) {
      if (/^cameras:\s*$/.test(line)) {
        inCameras = true;
        continue;
      }
      if (inCameras && /^\S/.test(line) && !line.startsWith("#")) {
        inCameras = false;
        continue;
      }
      if (inCameras) {
        const match = line.match(/^\s{2}(\w+):\s*$/);
        if (match && !match[1].startsWith("#")) {
          cameraNames.push(match[1]);
        }
      }
    }
    res.json(cameraNames);
  } catch (err) {
    console.error("[api] Failed to read Frigate config:", err);
    res.status(500).json({ error: "Failed to read camera config" });
  }
});

// GET /api/health — system health check
app.get("/api/health", async (_req: Request, res: Response) => {
  let frigateUp = false;
  try {
    const resp = await axios.get(`${FRIGATE_API_URL}/api/version`, {
      timeout: 3000,
    });
    frigateUp = resp.status === 200;
  } catch {
    frigateUp = false;
  }

  res.json({
    mqtt: isMqttConnected(),
    frigate: frigateUp,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

// GET /api/diagnostics — full system diagnostic report
app.get("/api/diagnostics", async (_req: Request, res: Response) => {
  try {
    const report = await runDiagnostics();
    res.json(report);
  } catch (err) {
    console.error("[api] Diagnostics failed:", err);
    res.status(500).json({ error: "Diagnostics failed" });
  }
});

// GET /api/snapshot/:eventId — proxy snapshot from Frigate
app.get("/api/snapshot/:eventId", async (req: Request, res: Response) => {
  const { eventId } = req.params;
  try {
    const response = await axios.get(
      `${FRIGATE_API_URL}/api/events/${eventId}/snapshot.jpg`,
      { responseType: "arraybuffer", timeout: 10000 }
    );
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(Buffer.from(response.data));
  } catch (err) {
    console.error(`[api] Snapshot fetch failed for ${eventId}:`, err);
    res.status(404).json({ error: "Snapshot not found" });
  }
});

export function startApiServer(): void {
  app.listen(API_PORT, () => {
    console.log(`[api] REST API listening on port ${API_PORT}`);
  });
}
