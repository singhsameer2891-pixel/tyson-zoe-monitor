import * as p from "@clack/prompts";
import pc from "picocolors";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { INSTALL_DIR, getLanIP } from "./utils.js";

const ENV_PATH = join(INSTALL_DIR, ".env");
const ENV_EXAMPLE_PATH = join(INSTALL_DIR, ".env.example");

export interface EnvConfig {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  GITHUB_GIST_TOKEN: string;
  HOST_IP: string;
  NOTIFICATION_COOLDOWN_SECONDS: string;
  FRIGATE_API_URL: string;
  MQTT_HOST: string;
  MQTT_PORT: string;
  API_PORT: string;
  VITE_API_URL: string;
}

export function readEnv(): EnvConfig | null {
  if (!existsSync(ENV_PATH)) return null;
  const raw = readFileSync(ENV_PATH, "utf-8");
  const config: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    config[key] = value;
  }
  return config as unknown as EnvConfig;
}

export function writeEnv(config: EnvConfig): void {
  const content = [
    "# Telegram",
    `TELEGRAM_BOT_TOKEN=${config.TELEGRAM_BOT_TOKEN}`,
    `TELEGRAM_CHAT_ID=${config.TELEGRAM_CHAT_ID}`,
    "",
    "# Remote Diagnostics",
    `GITHUB_GIST_TOKEN=${config.GITHUB_GIST_TOKEN}`,
    "",
    "# Notification",
    `NOTIFICATION_COOLDOWN_SECONDS=${config.NOTIFICATION_COOLDOWN_SECONDS}`,
    "",
    "# Frigate",
    `FRIGATE_API_URL=${config.FRIGATE_API_URL}`,
    "",
    "# MQTT",
    `MQTT_HOST=${config.MQTT_HOST}`,
    `MQTT_PORT=${config.MQTT_PORT}`,
    "",
    "# API",
    `API_PORT=${config.API_PORT}`,
    "",
    "# Dashboard",
    `VITE_API_URL=${config.VITE_API_URL}`,
    `HOST_IP=${config.HOST_IP}`,
    "",
  ].join("\n");

  writeFileSync(ENV_PATH, content, "utf-8");
}

export function hasEnv(): boolean {
  return existsSync(ENV_PATH);
}

/** Default values — user must configure on first run */
const DEFAULTS: EnvConfig = {
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_CHAT_ID: "",
  GITHUB_GIST_TOKEN: "",
  HOST_IP: "",
  NOTIFICATION_COOLDOWN_SECONDS: "60",
  FRIGATE_API_URL: "http://frigate:5000",
  MQTT_HOST: "mosquitto",
  MQTT_PORT: "1883",
  API_PORT: "4000",
  VITE_API_URL: "http://localhost:4000",
};

export function getDefaultConfig(): EnvConfig {
  // Try reading existing .env first, fall back to hardcoded defaults
  const existing = readEnv();
  const detectedIP = getLanIP();
  return {
    ...DEFAULTS,
    ...existing,
    HOST_IP: existing?.HOST_IP || detectedIP,
  };
}

export async function collectConfig(askUser: boolean = false): Promise<EnvConfig | null> {
  const defaults = getDefaultConfig();

  // If not asking user AND credentials exist, just auto-detect IP and return
  if (!askUser && defaults.TELEGRAM_BOT_TOKEN && defaults.TELEGRAM_CHAT_ID) {
    const detectedIP = getLanIP();
    defaults.HOST_IP = detectedIP;
    console.log(`  ${pc.green("✔")} Telegram Bot: ${pc.dim("configured")}`);
    console.log(`  ${pc.green("✔")} Chat ID:      ${pc.cyan(defaults.TELEGRAM_CHAT_ID)}`);
    console.log(`  ${pc.green("✔")} Gist Token:   ${defaults.GITHUB_GIST_TOKEN ? pc.dim("configured") : pc.yellow("not set")}`);
    console.log(`  ${pc.green("✔")} Host IP:      ${pc.cyan(defaults.HOST_IP)}`);
    console.log();
    return defaults;
  }

  // Interactive mode — show current values, let user change
  p.note(
    "Current values shown as defaults. Press Enter to keep, or type to change.",
    "Configuration"
  );

  const token = await p.text({
    message: "Telegram Bot Token",
    placeholder: defaults.TELEGRAM_BOT_TOKEN,
    defaultValue: defaults.TELEGRAM_BOT_TOKEN,
    validate: (v) => {
      if (!v || v.length < 20) return "Token must be at least 20 characters";
    },
  });
  if (p.isCancel(token)) return null;

  const chatId = await p.text({
    message: "Telegram Chat ID",
    placeholder: defaults.TELEGRAM_CHAT_ID,
    defaultValue: defaults.TELEGRAM_CHAT_ID,
    validate: (v) => {
      if (!v || isNaN(Number(v))) return "Must be a number (negative for groups)";
    },
  });
  if (p.isCancel(chatId)) return null;

  const gistToken = await p.text({
    message: "GitHub Gist Token (for remote diagnostics, optional — press Enter to skip)",
    placeholder: defaults.GITHUB_GIST_TOKEN || "ghp_...",
    defaultValue: defaults.GITHUB_GIST_TOKEN,
  });
  if (p.isCancel(gistToken)) return null;

  const detectedIP = getLanIP();

  console.log();
  console.log(`  ${pc.green("✔")} Token:      ${pc.dim(String(token).slice(0, 10) + "...")}`);
  console.log(`  ${pc.green("✔")} Chat ID:    ${pc.cyan(String(chatId))}`);
  console.log(`  ${pc.green("✔")} Gist Token: ${gistToken ? pc.dim(String(gistToken).slice(0, 10) + "...") : pc.yellow("skipped")}`);
  console.log(`  ${pc.green("✔")} Host IP:    ${pc.cyan(detectedIP)} ${pc.dim("(auto-detected)")}`);
  console.log();

  return {
    ...defaults,
    TELEGRAM_BOT_TOKEN: String(token),
    TELEGRAM_CHAT_ID: String(chatId),
    GITHUB_GIST_TOKEN: String(gistToken || ""),
    HOST_IP: detectedIP,
  };
}
