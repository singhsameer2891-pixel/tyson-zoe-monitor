import axios from "axios";
import { isMqttConnected, startTime } from "./index";
import { loadRules } from "./ruleEngine";
import os from "os";

const FRIGATE_API_URL = process.env.FRIGATE_API_URL || "http://frigate:5000";

export interface CameraDiagnostic {
  name: string;
  enabled: boolean;
  detecting: boolean;
  fps: number | null;
  pid: number | null;
  ffmpegError: string | null;
}

export interface DiagnosticReport {
  timestamp: string;
  hostname: string;
  platform: string;
  uptime_seconds: number;
  mqtt: {
    connected: boolean;
  };
  frigate: {
    reachable: boolean;
    version: string | null;
    error: string | null;
  };
  cameras: CameraDiagnostic[];
  network: {
    interfaces: Record<string, string>;
  };
  rules: {
    total: number;
    enabled: number;
  };
  env: {
    FRIGATE_API_URL: string;
    MQTT_HOST: string;
    MQTT_PORT: string;
    TELEGRAM_CONFIGURED: boolean;
    GITHUB_GIST_TOKEN_SET: boolean;
  };
}

/** Get all network interface IPs (non-internal only) */
function getNetworkInterfaces(): Record<string, string> {
  const result: Record<string, string> = {};
  const interfaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        result[name] = addr.address;
      }
    }
  }
  return result;
}

/** Check Frigate API and get version */
async function checkFrigate(): Promise<{ reachable: boolean; version: string | null; error: string | null }> {
  try {
    const resp = await axios.get(`${FRIGATE_API_URL}/api/version`, { timeout: 5000 });
    return { reachable: true, version: String(resp.data), error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { reachable: false, version: null, error: msg };
  }
}

/** Get per-camera status from Frigate stats endpoint */
async function getCameraStats(): Promise<CameraDiagnostic[]> {
  try {
    const resp = await axios.get(`${FRIGATE_API_URL}/api/stats`, { timeout: 5000 });
    const stats = resp.data;
    const cameras: CameraDiagnostic[] = [];

    if (stats.cameras) {
      for (const [name, cam] of Object.entries(stats.cameras) as [string, any][]) {
        const ffmpegPid = cam.ffmpeg_pid ?? cam.capture_pid ?? null;
        const detecting = cam.detection_enabled ?? false;
        const fps = cam.detection_fps ?? cam.camera_fps ?? null;

        // Check for ffmpeg errors via Frigate logs endpoint
        let ffmpegError: string | null = null;
        if (!ffmpegPid || ffmpegPid === 0) {
          ffmpegError = "ffmpeg process not running — likely RTSP connection failure";
        }

        cameras.push({
          name,
          enabled: detecting,
          detecting,
          fps: typeof fps === "number" ? Math.round(fps * 100) / 100 : null,
          pid: ffmpegPid,
          ffmpegError,
        });
      }
    }

    return cameras;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return [{ name: "unknown", enabled: false, detecting: false, fps: null, pid: null, ffmpegError: `Stats unavailable: ${msg}` }];
  }
}

/** Run full diagnostic check */
export async function runDiagnostics(): Promise<DiagnosticReport> {
  const [frigate, cameras] = await Promise.all([
    checkFrigate(),
    getCameraStats(),
  ]);

  const rules = loadRules();

  return {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.arch()}`,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    mqtt: {
      connected: isMqttConnected(),
    },
    frigate,
    cameras,
    network: {
      interfaces: getNetworkInterfaces(),
    },
    rules: {
      total: rules.length,
      enabled: rules.filter((r) => r.enabled).length,
    },
    env: {
      FRIGATE_API_URL: process.env.FRIGATE_API_URL || "http://frigate:5000",
      MQTT_HOST: process.env.MQTT_HOST || "mosquitto",
      MQTT_PORT: process.env.MQTT_PORT || "1883",
      TELEGRAM_CONFIGURED: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      GITHUB_GIST_TOKEN_SET: !!process.env.GITHUB_GIST_TOKEN,
    },
  };
}
