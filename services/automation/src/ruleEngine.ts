import fs from "fs";
import path from "path";
import { Rule, FrigateEvent } from "./types";

const RULES_PATH = process.env.RULES_PATH || "/config/rules.json";

/** Track last notification time per rule for cooldown */
const lastNotifiedAt: Map<string, number> = new Map();

export function loadRules(): Rule[] {
  const raw = fs.readFileSync(RULES_PATH, "utf-8");
  return JSON.parse(raw) as Rule[];
}

export function saveRules(rules: Rule[]): void {
  fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2), "utf-8");
}

/** Check if current time falls within the rule's time restriction window */
export function isWithinTimeRestriction(rule: Rule): boolean {
  if (!rule.timeRestriction || !rule.timeRestriction.enabled) {
    return true; // no restriction = always active
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const { startHour, startMinute = 0, endHour, endMinute = 0 } = rule.timeRestriction;
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  // Handle overnight ranges (e.g. 22:30 → 06:15)
  if (startTotal > endTotal) {
    return currentMinutes >= startTotal || currentMinutes < endTotal;
  }
  // Same-day range (e.g. 09:00 → 17:30)
  return currentMinutes >= startTotal && currentMinutes < endTotal;
}

/** Check if the cooldown period has elapsed for this rule */
export function isCooldownElapsed(ruleId: string): boolean {
  const cooldownSeconds = parseInt(
    process.env.NOTIFICATION_COOLDOWN_SECONDS || "60",
    10
  );
  const lastTime = lastNotifiedAt.get(ruleId);
  if (!lastTime) return true;

  return Date.now() - lastTime >= cooldownSeconds * 1000;
}

/** Record that a notification was sent for this rule */
export function markNotified(ruleId: string): void {
  lastNotifiedAt.set(ruleId, Date.now());
}

export interface RuleMatch {
  rule: Rule;
  camera: string;
  zone: string;
  objectType: string;
  eventId: string;
}

/** Evaluate a Frigate event against all rules, return matching rules */
export function evaluateEvent(event: FrigateEvent): RuleMatch[] {
  const rules = loadRules();
  const matches: RuleMatch[] = [];

  const after = event.after;
  if (!after) return matches;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    // Match camera
    if (rule.camera !== after.camera) continue;

    // Match object type
    if (rule.objectType !== after.label) continue;

    // Match zone — check if the object has entered the rule's zone
    const zonesEntered = after.entered_zones || [];
    if (!zonesEntered.includes(rule.zone)) continue;

    // Match action — for "entered", we look at type "new" or zones changing
    if (rule.action === "entered" && event.type !== "new" && event.type !== "update") continue;

    // Check time restriction
    if (!isWithinTimeRestriction(rule)) continue;

    // Check cooldown
    if (!isCooldownElapsed(rule.id)) continue;

    matches.push({
      rule,
      camera: after.camera,
      zone: rule.zone,
      objectType: after.label,
      eventId: after.id,
    });
  }

  return matches;
}
