import axios from "axios";
import { Rule } from "./types";

const FRIGATE_API_URL = process.env.FRIGATE_API_URL || "http://frigate:5000";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

const RETRY_INTERVAL_MS = 5000;
const RETRY_DURATION_MS = 300000;

/** Fetch latest camera frame from Frigate (captures the moment of zone entry) */
export async function fetchSnapshot(camera: string): Promise<Buffer> {
  const url = `${FRIGATE_API_URL}/api/${camera}/latest.jpg?h=720`;
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 10000,
  });
  return Buffer.from(response.data);
}

/** Build notification caption from rule and event details */
function buildCaption(
  rule: Rule,
  camera: string,
  zone: string
): string {
  const now = new Date();
  const timeStr = now.toLocaleString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return [
    rule.notificationTemplate,
    `📷 Camera: ${camera}`,
    `🕐 Time: ${timeStr}`,
    `📍 Zone: ${zone}`,
  ].join("\n");
}

/** Attempt a single Telegram send. Returns true on success. */
async function attemptSend(
  camera: string,
  caption: string
): Promise<boolean> {
  const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

  let imageBuffer: Buffer | null = null;
  try {
    imageBuffer = await fetchSnapshot(camera);
  } catch (err) {
    console.error(`[notifier] Failed to fetch snapshot for ${camera}:`, err);
  }

  if (imageBuffer) {
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("chat_id", TELEGRAM_CHAT_ID);
    form.append("caption", caption);
    form.append("photo", imageBuffer, {
      filename: "snapshot.jpg",
      contentType: "image/jpeg",
    });

    await axios.post(`${telegramUrl}/sendPhoto`, form, {
      headers: form.getHeaders(),
      timeout: 15000,
    });
  } else {
    await axios.post(`${telegramUrl}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: `📸 (snapshot unavailable)\n\n${caption}`,
    }, { timeout: 15000 });
  }

  return true;
}

/** Send Telegram notification with retry (every 5s for up to 300s on failure) */
export async function sendTelegramNotification(
  rule: Rule,
  camera: string,
  zone: string,
  eventId: string
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("[notifier] Telegram credentials not configured, skipping notification");
    return false;
  }

  // Small delay to ensure object is fully in zone before first capture
  await new Promise((resolve) => setTimeout(resolve, 500));

  const caption = buildCaption(rule, camera, zone);
  const maxAttempts = Math.floor(RETRY_DURATION_MS / RETRY_INTERVAL_MS);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await attemptSend(camera, caption);
      console.log(`[notifier] Sent Telegram notification for rule "${rule.name}" (attempt ${attempt})`);
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[notifier] Attempt ${attempt}/${maxAttempts} failed for rule "${rule.name}": ${errMsg}`);

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
      }
    }
  }

  console.error(`[notifier] All ${maxAttempts} attempts failed for rule "${rule.name}" — giving up`);
  return false;
}
