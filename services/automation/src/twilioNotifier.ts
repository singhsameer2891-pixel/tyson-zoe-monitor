import twilio from "twilio";
import { Rule } from "./types";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || "";
const TWILIO_TO_NUMBERS = (process.env.TWILIO_TO_NUMBER || "")
  .split(",")
  .map((n) => n.trim())
  .filter(Boolean);
const TWILIO_MAX_RETRIES = 2;

/** Build spoken alert message from rule + event details */
function buildVoiceMessage(rule: Rule, camera: string, zone: string): string {
  const now = new Date();
  const timeStr = now.toLocaleString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  return `Alert from Tyson and Zoe Monitor. ${rule.notificationTemplate}. Camera: ${camera}. Zone: ${zone}. Time: ${timeStr}. Repeating: ${rule.notificationTemplate}.`;
}

/** Check if Twilio credentials are configured */
export function isTwilioConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER && TWILIO_TO_NUMBERS.length > 0);
}

/** Call a single number with retries. Returns true if call was initiated. */
async function callNumber(
  client: ReturnType<typeof twilio>,
  toNumber: string,
  twiml: string,
  ruleName: string
): Promise<boolean> {
  for (let attempt = 1; attempt <= TWILIO_MAX_RETRIES + 1; attempt++) {
    try {
      const call = await client.calls.create({
        twiml,
        to: toNumber,
        from: TWILIO_FROM_NUMBER,
        timeout: 30,
      });
      console.log(`[twilio] Call to ${toNumber} initiated for rule "${ruleName}" — SID: ${call.sid} (attempt ${attempt})`);
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[twilio] Attempt ${attempt}/${TWILIO_MAX_RETRIES + 1} to ${toNumber} failed for rule "${ruleName}": ${errMsg}`);
      if (attempt <= TWILIO_MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }
  console.error(`[twilio] All attempts to ${toNumber} failed for rule "${ruleName}" — giving up`);
  return false;
}

/** Make Twilio voice calls to all configured numbers in parallel */
export async function sendTwilioCall(
  rule: Rule,
  camera: string,
  zone: string,
  eventId: string
): Promise<boolean> {
  if (!isTwilioConfigured()) {
    console.warn("[twilio] Twilio credentials not configured, skipping call");
    return false;
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const message = buildVoiceMessage(rule, camera, zone);
  const twiml = `<Response><Say voice="alice" language="en-IN">${message}</Say><Pause length="1"/><Say voice="alice" language="en-IN">${message}</Say></Response>`;

  const results = await Promise.all(
    TWILIO_TO_NUMBERS.map((num) => callNumber(client, num, twiml, rule.name))
  );

  return results.some(Boolean);
}
