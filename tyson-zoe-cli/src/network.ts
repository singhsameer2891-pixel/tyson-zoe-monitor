import { execaSync, execa } from "execa";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import net from "net";
import { getOS, getLanIP, INSTALL_DIR } from "./utils.js";

const FRIGATE_CONFIG_PATH = join(INSTALL_DIR, "config", "frigate.yml");

/** Check if an IP looks like a valid LAN address (not self-assigned) */
export function isValidLanIP(ip: string): boolean {
  if (!ip || ip === "localhost") return false;
  // Self-assigned IPs (DHCP failure)
  if (ip.startsWith("169.254.")) return false;
  if (ip === "192.0.0.2") return false;
  // Must be a private range
  return (
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.2") ||
    ip.startsWith("172.30.") ||
    ip.startsWith("172.31.")
  );
}

/** Try to reach a host on a specific port */
export function isHostReachable(
  host: string,
  port: number,
  timeoutMs: number = 3000
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

/** Scan a subnet for a device responding on a specific port */
export async function scanForDevice(
  subnet: string,
  port: number
): Promise<string | null> {
  // Scan common DVR IPs first (speeds up discovery)
  const priorityIPs = [245, 200, 100, 108, 64, 10, 2, 1];
  const remaining: number[] = [];
  for (let i = 2; i <= 254; i++) {
    if (!priorityIPs.includes(i)) remaining.push(i);
  }
  const allIPs = [...priorityIPs, ...remaining];

  // Scan in batches of 20 for speed
  for (let batch = 0; batch < allIPs.length; batch += 20) {
    const chunk = allIPs.slice(batch, batch + 20);
    const checks = chunk.map((i) => {
      const ip = `${subnet}.${i}`;
      return isHostReachable(ip, port, 1500).then((ok) => (ok ? ip : null));
    });
    const results = await Promise.all(checks);
    const found = results.find((r) => r !== null);
    if (found) return found;
  }

  return null;
}

/** Detect the LAN subnet from current IP */
export function getSubnet(ip: string): string {
  const parts = ip.split(".");
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

/** Try to fix DHCP failure by setting a static IP */
export function tryStaticIPFix(subnet: string): boolean {
  const os = getOS();
  const staticIP = `${subnet}.200`;

  try {
    if (os === "mac") {
      execaSync("networksetup", [
        "-setmanual",
        "Wi-Fi",
        staticIP,
        "255.255.255.0",
        `${subnet}.1`,
      ]);
      // Verify it worked
      const newIP = getLanIP();
      return isValidLanIP(newIP);
    } else if (os === "windows") {
      execaSync("powershell", [
        "-Command",
        `New-NetIPAddress -InterfaceAlias Wi-Fi -IPAddress ${staticIP} -PrefixLength 24 -DefaultGateway ${subnet}.1 -ErrorAction SilentlyContinue`,
      ]);
      return true;
    }
  } catch {
    // static IP assignment failed
  }
  return false;
}

/** Switch back to DHCP */
export function switchToDHCP(): void {
  const os = getOS();
  try {
    if (os === "mac") {
      execaSync("networksetup", ["-setdhcp", "Wi-Fi"]);
    } else if (os === "windows") {
      execaSync("powershell", [
        "-Command",
        "Set-NetIPInterface -InterfaceAlias Wi-Fi -Dhcp Enabled",
      ]);
    }
  } catch {
    // ignore
  }
}

/** Identify a device as a DVR by checking its HTTP response */
export async function identifyDVR(ip: string): Promise<string | null> {
  try {
    const resp = await fetch(`http://${ip}/`, {
      signal: AbortSignal.timeout(3000),
    });
    const body = await resp.text();
    if (
      body.includes("CP PLUS") ||
      body.includes("cpplus") ||
      body.includes("WEB SERVICE") ||
      body.includes("NVR") ||
      body.includes("DVR")
    ) {
      return ip;
    }
  } catch {
    // not a DVR
  }
  return null;
}

/** Update the DVR IP in frigate.yml go2rtc streams */
export function updateFrigateConfigDVRIP(
  newIP: string,
  oldIP?: string
): void {
  try {
    let config = readFileSync(FRIGATE_CONFIG_PATH, "utf-8");
    if (oldIP) {
      // Replace old IP with new
      config = config.replaceAll(oldIP, newIP);
    } else {
      // Replace any IP in RTSP URLs
      config = config.replace(
        /(@)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:554)/g,
        `$1${newIP}$2`
      );
    }
    writeFileSync(FRIGATE_CONFIG_PATH, config, "utf-8");
  } catch {
    // config file may not exist yet on first run
  }
}

/** Extract current DVR IP from frigate.yml */
export function getCurrentDVRIP(): string | null {
  try {
    const config = readFileSync(FRIGATE_CONFIG_PATH, "utf-8");
    const match = config.match(/@(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):554/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Extract RTSP URLs from frigate.yml go2rtc section */
export function getRTSPUrls(): string[] {
  try {
    const config = readFileSync(FRIGATE_CONFIG_PATH, "utf-8");
    const urls: string[] = [];
    const regex = /- rtsp:\/\/[^\s]+/g;
    let match;
    while ((match = regex.exec(config)) !== null) {
      urls.push(match[0].replace("- ", ""));
    }
    // Return only main streams (not sub streams, to keep it fast)
    return urls.filter((u) => !u.includes("_sub"));
  } catch {
    return [];
  }
}

/** Test an RTSP stream using ffprobe via Docker (runs inside Frigate container if available, else host) */
export async function validateRTSPStream(
  rtspUrl: string,
  timeoutMs: number = 10000
): Promise<{ ok: boolean; error: string | null }> {
  try {
    // Try ffprobe via the Frigate container first (it has ffmpeg installed)
    const result = await execa("docker", [
      "exec", "cctv-frigate",
      "ffprobe",
      "-v", "error",
      "-show_entries", "stream=codec_name,width,height",
      "-of", "csv",
      "-rtsp_transport", "tcp",
      rtspUrl,
    ], { timeout: timeoutMs });

    if (result.stdout && result.stdout.trim().length > 0) {
      return { ok: true, error: null };
    }
    return { ok: false, error: "ffprobe returned no stream info" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("401") || msg.includes("Unauthorized")) {
      return { ok: false, error: "Authentication failed — wrong username/password" };
    }
    if (msg.includes("Connection refused")) {
      return { ok: false, error: "Connection refused — RTSP port not open on DVR" };
    }
    if (msg.includes("timed out") || msg.includes("timeout")) {
      return { ok: false, error: "Timeout — DVR not reachable from Docker container (check Docker network_mode)" };
    }
    return { ok: false, error: msg.slice(0, 200) };
  }
}

/** Full network check and auto-recovery. Returns { hostIP, dvrIP } or throws. */
export async function ensureNetwork(): Promise<{
  hostIP: string;
  dvrIP: string;
  staticIPUsed: boolean;
  dvrDiscovered: boolean;
}> {
  let hostIP = getLanIP();
  let staticIPUsed = false;
  let dvrDiscovered = false;

  // Step 1: Check if we have a valid LAN IP
  if (!isValidLanIP(hostIP)) {
    // DHCP failed — try static IP fix on 192.168.31.x (most common home subnet)
    // Try common subnets
    const subnets = ["192.168.31", "192.168.1", "192.168.0", "10.0.0"];
    for (const subnet of subnets) {
      const fixed = tryStaticIPFix(subnet);
      if (fixed) {
        hostIP = getLanIP();
        staticIPUsed = true;
        break;
      }
    }

    if (!isValidLanIP(hostIP)) {
      throw new Error(
        "Could not get a valid LAN IP. Check your Wi-Fi connection."
      );
    }
  }

  const subnet = getSubnet(hostIP);

  // Step 2: Check if configured DVR IP is reachable
  const configuredDVR = getCurrentDVRIP();
  if (configuredDVR) {
    const reachable = await isHostReachable(configuredDVR, 554);
    if (reachable) {
      return { hostIP, dvrIP: configuredDVR, staticIPUsed, dvrDiscovered: false };
    }
  }

  // Step 3: DVR not reachable at configured IP — scan the network
  const foundIP = await scanForDevice(subnet, 554);
  if (foundIP) {
    // Verify it's actually a DVR
    const isDVR = await identifyDVR(foundIP);
    if (isDVR) {
      dvrDiscovered = true;
      // Update frigate config with new IP
      if (configuredDVR && configuredDVR !== foundIP) {
        updateFrigateConfigDVRIP(foundIP, configuredDVR);
      }
      return { hostIP, dvrIP: foundIP, staticIPUsed, dvrDiscovered };
    }
  }

  // Step 4: No DVR found — use configured IP and hope for the best
  if (configuredDVR) {
    return { hostIP, dvrIP: configuredDVR, staticIPUsed, dvrDiscovered: false };
  }

  throw new Error(
    `No DVR found on subnet ${subnet}.x. Ensure the DVR is powered on and on the same network.`
  );
}
