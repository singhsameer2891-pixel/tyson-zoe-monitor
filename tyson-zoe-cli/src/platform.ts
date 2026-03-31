import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { INSTALL_DIR, getOS } from "./utils.js";

const COMPOSE_PATH = join(INSTALL_DIR, "docker-compose.yml");
const FRIGATE_CONFIG_PATH = join(INSTALL_DIR, "config", "frigate.yml");

/**
 * On Windows, Docker Desktop (WSL2) bridge networking can't reach LAN devices.
 * Frigate needs to pull RTSP streams from the DVR on the local network.
 * Fix: switch Frigate to host networking on Windows so it can access the LAN directly.
 *
 * On Mac, bridge networking works fine — no changes needed.
 */
export function applyPlatformFixes(): void {
  const os = getOS();
  if (os !== "windows") return;

  patchDockerCompose();
  patchFrigateConfig();
}

/** Patch docker-compose.yml: Frigate gets network_mode: host on Windows */
function patchDockerCompose(): void {
  try {
    let compose = readFileSync(COMPOSE_PATH, "utf-8");

    // Skip if already patched
    if (compose.includes("network_mode: host")) return;

    // Remove ports mapping from frigate (host mode doesn't use them)
    compose = compose.replace(
      /(\s+)ports:\s*\n\s+- "5001:5000"\s*#[^\n]*\n\s+- "8554:8554"\s*#[^\n]*/,
      ""
    );

    // Also handle without comments
    compose = compose.replace(
      /(\s+)ports:\s*\n\s+- "5001:5000"\s*\n\s+- "8554:8554"\s*/,
      ""
    );

    // Add network_mode: host after container_name for frigate
    compose = compose.replace(
      /(container_name: cctv-frigate\s*\n\s+restart: unless-stopped)/,
      "$1\n    network_mode: host"
    );

    // Remove frigate from cctv-net (host mode can't use named networks)
    // Find the frigate service's networks section and remove it
    // This is tricky with YAML — let's just remove the networks line under frigate
    const lines = compose.split("\n");
    const result: string[] = [];
    let inFrigateService = false;
    let inFrigateNetworks = false;
    let frigateIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect when we enter the frigate service
      if (/^\s{2}frigate:/.test(line)) {
        inFrigateService = true;
        frigateIndent = 2;
      }
      // Detect when we leave frigate service (next service at same indent)
      else if (inFrigateService && /^\s{2}\w+:/.test(line) && !/^\s{4}/.test(line)) {
        inFrigateService = false;
      }

      // Skip networks section within frigate service
      if (inFrigateService && /^\s+networks:\s*$/.test(line)) {
        inFrigateNetworks = true;
        continue;
      }
      if (inFrigateNetworks) {
        if (/^\s+- cctv-net/.test(line)) {
          inFrigateNetworks = false;
          continue;
        }
        // If it's another key at the same level, we've left networks
        if (!/^\s+-/.test(line) && line.trim().length > 0) {
          inFrigateNetworks = false;
        } else {
          continue;
        }
      }

      result.push(line);
    }

    let patched = result.join("\n");

    // Change dashboard's Frigate URL from port 5001 to 5000 (host mode uses Frigate's native port)
    patched = patched.replace(
      /VITE_FRIGATE_URL:\s*"http:\/\/\$\{HOST_IP:-localhost\}:5001"/,
      'VITE_FRIGATE_URL: "http://${HOST_IP:-localhost}:5000"'
    );

    writeFileSync(COMPOSE_PATH, patched, "utf-8");
    console.log("    [platform] Patched docker-compose.yml: Frigate → host networking (port 5000)");
  } catch (err) {
    console.error("    [platform] Failed to patch docker-compose.yml:", err);
  }
}

/** Patch frigate.yml: MQTT host changes from 'mosquitto' to 'localhost' on Windows */
function patchFrigateConfig(): void {
  try {
    let config = readFileSync(FRIGATE_CONFIG_PATH, "utf-8");

    // Only change mqtt host, not other occurrences
    config = config.replace(
      /^(mqtt:\s*\n\s+host:\s*)mosquitto/m,
      "$1localhost"
    );

    writeFileSync(FRIGATE_CONFIG_PATH, config, "utf-8");
    console.log("    [platform] Patched frigate.yml: MQTT host → localhost");
  } catch (err) {
    console.error("    [platform] Failed to patch frigate.yml:", err);
  }
}
