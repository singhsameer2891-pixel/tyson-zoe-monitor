import dotenv from "dotenv";
dotenv.config();

import mqtt from "mqtt";
import { initDatabase, logEvent } from "./eventLogger";
import { evaluateEvent, markNotified } from "./ruleEngine";
import { sendTelegramNotification } from "./notifier";
import { sendTwilioCall } from "./twilioNotifier";
import { startApiServer } from "./apiServer";
import { runDiagnostics } from "./diagnostics";
import { pushDiagnostics } from "./gistLogger";
import { FrigateEvent } from "./types";

const MQTT_HOST = process.env.MQTT_HOST || "mosquitto";
const MQTT_PORT = parseInt(process.env.MQTT_PORT || "1883", 10);

/** Track processed events to avoid duplicate processing */
const processedEvents: Set<string> = new Set();
const MAX_PROCESSED_CACHE = 1000;

let mqttConnected = false;
export const startTime = Date.now();

export function isMqttConnected(): boolean {
  return mqttConnected;
}

function pruneProcessedCache(): void {
  if (processedEvents.size > MAX_PROCESSED_CACHE) {
    const entries = Array.from(processedEvents);
    entries.slice(0, entries.length - MAX_PROCESSED_CACHE / 2).forEach((e) =>
      processedEvents.delete(e)
    );
  }
}

async function handleFrigateEvent(payload: string): Promise<void> {
  let event: FrigateEvent;
  try {
    event = JSON.parse(payload);
  } catch {
    console.error("[mqtt] Failed to parse event payload");
    return;
  }

  const after = event.after;
  if (!after) return;

  // Deduplicate: only process each event+zone combo once
  const dedupeKey = `${after.id}:${after.entered_zones?.join(",")}`;
  if (processedEvents.has(dedupeKey)) return;
  processedEvents.add(dedupeKey);
  pruneProcessedCache();

  console.log(
    `[event] ${after.label} detected on ${after.camera} in zones [${after.current_zones?.join(", ")}]`
  );

  // Evaluate against rules
  const matches = evaluateEvent(event);

  if (matches.length === 0) {
    // Log unmatched event for visibility
    logEvent({
      event_id: after.id,
      camera: after.camera,
      zone: after.current_zones?.[0] || "unknown",
      object_type: after.label,
      rule_id: null,
      rule_name: null,
      notified: false,
      snapshot_path: null,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  for (const match of matches) {
    console.log(`[rule] Match: "${match.rule.name}" → sending notification`);

    // Fire Telegram + Twilio in parallel
    const [telegramSent, twilioSent] = await Promise.all([
      sendTelegramNotification(match.rule, match.camera, match.zone, match.eventId),
      sendTwilioCall(match.rule, match.camera, match.zone, match.eventId),
    ]);

    const sent = telegramSent || twilioSent;

    // Only mark cooldown if at least one notification was delivered
    if (sent) {
      markNotified(match.rule.id);
    }

    // Log event with actual delivery status
    logEvent({
      event_id: match.eventId,
      camera: match.camera,
      zone: match.zone,
      object_type: match.objectType,
      rule_id: match.rule.id,
      rule_name: match.rule.name,
      notified: sent,
      snapshot_path: null,
      timestamp: new Date().toISOString(),
    });
  }
}

function startMqtt(): void {
  const brokerUrl = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
  console.log(`[mqtt] Connecting to ${brokerUrl}...`);

  const client = mqtt.connect(brokerUrl, {
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  client.on("connect", () => {
    mqttConnected = true;
    console.log("[mqtt] Connected to broker");

    // Subscribe to Frigate event topics
    client.subscribe("frigate/events", (err) => {
      if (err) console.error("[mqtt] Subscribe error:", err);
      else console.log("[mqtt] Subscribed to frigate/events");
    });
  });

  client.on("message", (_topic: string, message: Buffer) => {
    handleFrigateEvent(message.toString()).catch((err) =>
      console.error("[mqtt] Error handling event:", err)
    );
  });

  client.on("error", (err) => {
    console.error("[mqtt] Connection error:", err);
    mqttConnected = false;
  });

  client.on("close", () => {
    mqttConnected = false;
    console.log("[mqtt] Connection closed, will reconnect...");
  });
}

function main(): void {
  console.log("=== CCTV Automation Service Starting ===");

  // Init SQLite
  initDatabase();
  console.log("[db] SQLite initialized");

  // Start MQTT
  startMqtt();

  // Start REST API for dashboard
  startApiServer();

  // Run diagnostics on startup + every 1 min, push to GitHub Gist
  const runAndPush = async () => {
    try {
      const report = await runDiagnostics();
      await pushDiagnostics(report);
    } catch (err) {
      console.error("[diagnostics] Error:", err instanceof Error ? err.message : err);
    }
  };

  // Delay first run by 15s to let Frigate/MQTT stabilize
  setTimeout(() => {
    runAndPush();
    setInterval(runAndPush, 60_000);
  }, 15_000);

  console.log("[service] Automation service running");
}

main();
