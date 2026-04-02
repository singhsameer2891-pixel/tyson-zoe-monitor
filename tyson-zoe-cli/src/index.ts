#!/usr/bin/env node
import * as p from "@clack/prompts";
import pc from "picocolors";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { showBanner } from "./banner.js";
import {
  isDockerInstalled,
  isDockerRunning,
  isProjectInstalled,
  cloneProject,
  guideDockerInstall,
  startDockerDesktop,
} from "./installer.js";
import { collectConfig, readEnv, writeEnv, hasEnv } from "./config.js";
import { ensureNetwork, getRTSPUrls, validateRTSPStream } from "./network.js";
import { applyPlatformFixes } from "./platform.js";
import {
  startServices,
  stopServices,
  isRunning,
  getUptime,
  getHealthStatus,
} from "./services.js";
import { openInBrowser, INSTALL_DIR, getOS } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "package.json"), "utf-8")
    );
    return pkg.version || "1.0.0";
  } catch {
    return "1.0.0";
  }
}

async function firstRunFlow(): Promise<void> {
  // Step 1: Docker check
  const s = p.spinner();

  s.start("Checking Docker installation...");
  if (!isDockerInstalled()) {
    s.stop(`${pc.red("✘")} Docker is not installed`);
    guideDockerInstall();
    p.note(
      "Install Docker Desktop, then run this command again.",
      "Action Required"
    );
    process.exit(1);
  }
  s.stop(`${pc.green("✔")} Docker installed`);

  s.start("Checking if Docker is running...");
  if (!isDockerRunning()) {
    s.stop(`${pc.yellow("!")} Docker is not running — starting Docker Desktop...`);
    const started = await startDockerDesktop();
    if (!started) {
      p.note(
        "Please start Docker Desktop manually, then run this command again.",
        "Action Required"
      );
      process.exit(1);
    }
    console.log(`  ${pc.green("✔")} Docker Desktop started`);
  } else {
    s.stop(`${pc.green("✔")} Docker running`);
  }

  // Step 2: Clone project
  s.start("Downloading TysonZoeMonitor...");
  try {
    await cloneProject();
    s.stop(`${pc.green("✔")} Project downloaded to ${pc.dim(INSTALL_DIR)}`);
  } catch (err) {
    s.stop(`${pc.red("✘")} Failed to download project`);
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(pc.red(`  ${errMsg}`));
    process.exit(1);
  }

  // Step 2.5: Apply OS-specific fixes (e.g., host networking on Windows)
  applyPlatformFixes();

  // Step 3: Network check — verify LAN + discover DVR
  s.start("Checking network...");
  try {
    const net = await ensureNetwork();
    const notes: string[] = [];
    if (net.dhcpFixed) notes.push("DHCP auto-fixed subnet mismatch");
    if (net.staticIPUsed) notes.push("static IP fallback");
    if (net.dvrDiscovered) notes.push("DVR auto-discovered");
    const extra = notes.length > 0 ? pc.dim(` (${notes.join(", ")})`) : "";
    s.stop(`${pc.green("✔")} Network OK${extra}`);
    console.log(`  ${pc.dim("Host IP:")} ${pc.cyan(net.hostIP)}  ${pc.dim("DVR:")} ${pc.cyan(net.dvrIP)}`);
    console.log();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    s.stop(`${pc.red("✘")} Network error: ${errMsg}`);
    process.exit(1);
  }

  // Step 4: Configuration (auto-config with defaults, no prompts)
  const config = await collectConfig(false);
  if (!config) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
  writeEnv(config);
  console.log(`  ${pc.green("✔")} Configuration saved\n`);

  // Step 5: Start services
  console.log(pc.bold("  Starting services...\n"));
  try {
    await startServices();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(pc.red(`\n  Failed to start services: ${errMsg}`));
    console.error(pc.dim(`  Check logs: docker compose -f ${INSTALL_DIR}/docker-compose.yml logs`));
    process.exit(1);
  }

  // Step 5.5: Validate RTSP streams
  const rtspUrls = getRTSPUrls();
  if (rtspUrls.length > 0) {
    console.log(`  ${pc.dim("Validating RTSP streams...")}`);
    for (const url of rtspUrls) {
      // Mask password in display
      const displayUrl = url.replace(/:([^@]+)@/, ":****@");
      const result = await validateRTSPStream(url);
      if (result.ok) {
        console.log(`  ${pc.green("✔")} ${pc.dim(displayUrl)}`);
      } else {
        console.log(`  ${pc.red("✘")} ${pc.dim(displayUrl)}`);
        console.log(`    ${pc.yellow(result.error || "Unknown error")}`);
      }
    }
    console.log();
  }

  // Step 6: Health check
  const health = await getHealthStatus();
  const fPort = getOS() === "windows" ? 5000 : 5050;

  console.log();
  const box = [
    "",
    `  ${pc.green("╔══════════════════════════════════════════════╗")}`,
    `  ${pc.green("║")}  ${pc.bold("🎉 TysonZoeMonitor is running!")}              ${pc.green("║")}`,
    `  ${pc.green("║")}                                              ${pc.green("║")}`,
    `  ${pc.green("║")}  Dashboard:  ${pc.cyan("http://localhost:3000")}            ${pc.green("║")}`,
    `  ${pc.green("║")}  Frigate UI: ${pc.cyan(`http://localhost:${fPort}`)}            ${pc.green("║")}`,
    `  ${pc.green("║")}  MQTT:       ${health?.mqtt ? pc.green("connected") : pc.red("disconnected")}                     ${pc.green("║")}`,
    `  ${pc.green("║")}  Frigate:    ${health?.frigate ? pc.green("connected") : pc.red("disconnected")}                     ${pc.green("║")}`,
    `  ${pc.green("║")}                                              ${pc.green("║")}`,
    `  ${pc.green("║")}  Run ${pc.bold("npx tyson-zoe-monitor")} again to manage.   ${pc.green("║")}`,
    `  ${pc.green("╚══════════════════════════════════════════════╝")}`,
    "",
  ].join("\n");
  console.log(box);
}

interface ModeInfo {
  active: boolean;
  scheduled: boolean;
  schedule: { enabled: boolean; startHour: number; startMinute?: number; endHour: number; endMinute?: number } | null;
  ruleCount: number;
}

const API_URL = "http://localhost:4000";

function parseTime(input: string): { hour: number; minute: number } | null {
  const match = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function formatModeStatus(mode: ModeInfo): string {
  if (!mode.active) return pc.red("OFF");
  if (mode.scheduled && mode.schedule) {
    const sh = String(mode.schedule.startHour).padStart(2, "0");
    const sm = String(mode.schedule.startMinute ?? 0).padStart(2, "0");
    const eh = String(mode.schedule.endHour).padStart(2, "0");
    const em = String(mode.schedule.endMinute ?? 0).padStart(2, "0");
    return `${pc.green("SCHEDULED")} ${pc.dim(`${sh}:${sm} → ${eh}:${em} IST`)}`;
  }
  return pc.green("ON (manual)");
}

async function fetchModes(): Promise<{ home: ModeInfo; "tyson-zoe": ModeInfo } | null> {
  try {
    const resp = await fetch(`${API_URL}/api/modes`, { signal: AbortSignal.timeout(5000) });
    return (await resp.json()) as { home: ModeInfo; "tyson-zoe": ModeInfo };
  } catch {
    return null;
  }
}

async function setMode(mode: string, enabled: boolean, timeRestriction?: { enabled: boolean; startHour: number; startMinute: number; endHour: number; endMinute: number }): Promise<boolean> {
  try {
    await fetch(`${API_URL}/api/rules/mode/${mode}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, timeRestriction: timeRestriction ?? { enabled: false } }),
      signal: AbortSignal.timeout(5000),
    });
    return true;
  } catch {
    return false;
  }
}

async function promptSchedule(mode: string, label: string): Promise<void> {
  const startTime = await p.text({
    message: `${label} — Start time (IST, hh:mm)`,
    placeholder: "22:00",
    defaultValue: "22:00",
    validate: (v) => { if (!parseTime(v)) return "Use hh:mm format (e.g. 22:30)"; },
  });
  if (p.isCancel(startTime)) return;

  const endTime = await p.text({
    message: `${label} — End time (IST, hh:mm)`,
    placeholder: "06:00",
    defaultValue: "06:00",
    validate: (v) => { if (!parseTime(v)) return "Use hh:mm format (e.g. 06:00)"; },
  });
  if (p.isCancel(endTime)) return;

  const start = parseTime(String(startTime))!;
  const end = parseTime(String(endTime))!;

  const ok = await setMode(mode, true, {
    enabled: true,
    startHour: start.hour, startMinute: start.minute,
    endHour: end.hour, endMinute: end.minute,
  });
  if (ok) {
    console.log(`\n  ${pc.green("✔")} ${label} scheduled: ${startTime} → ${endTime} IST`);
  } else {
    console.log(`\n  ${pc.red("✘")} Failed to set schedule`);
  }
}

async function monitoringModesMenu(): Promise<void> {
  const modes = await fetchModes();
  if (!modes) {
    console.log(`\n  ${pc.red("✘")} Could not reach automation service. Is it running?`);
    return;
  }

  console.log(`\n  ${pc.bold("Monitoring Modes")}`);
  console.log(`  ${pc.dim("─────────────────────────────────────────")}`);
  console.log(`  🏠 Home Monitoring:       ${formatModeStatus(modes.home)}`);
  console.log(`  🐕 Tyson/Zoe Monitoring:  ${formatModeStatus(modes["tyson-zoe"])}\n`);

  const modeAction = await p.select({
    message: "What would you like to do?",
    options: [
      { value: "toggle-home", label: `${modes.home.active ? "Turn OFF" : "Turn ON"} Home Monitoring`, hint: "Boundary cross alerts (person)" },
      { value: "toggle-tyson", label: `${modes["tyson-zoe"].active ? "Turn OFF" : "Turn ON"} Tyson/Zoe Monitoring`, hint: "Dog detection alerts" },
      { value: "schedule-home", label: "Schedule Home Monitoring", hint: "Daily time range (IST)" },
      { value: "schedule-tyson", label: "Schedule Tyson/Zoe Monitoring", hint: "Daily time range (IST)" },
      { value: "back", label: "Back" },
    ],
  });

  if (p.isCancel(modeAction) || modeAction === "back") return;

  if (modeAction === "toggle-home") {
    const ok = await setMode("home", !modes.home.active);
    if (ok) console.log(`\n  ${pc.green("✔")} Home Monitoring ${!modes.home.active ? pc.green("ON") : pc.red("OFF")}`);
  } else if (modeAction === "toggle-tyson") {
    const ok = await setMode("tyson-zoe", !modes["tyson-zoe"].active);
    if (ok) console.log(`\n  ${pc.green("✔")} Tyson/Zoe Monitoring ${!modes["tyson-zoe"].active ? pc.green("ON") : pc.red("OFF")}`);
  } else if (modeAction === "schedule-home") {
    await promptSchedule("home", "Home Monitoring");
  } else if (modeAction === "schedule-tyson") {
    await promptSchedule("tyson-zoe", "Tyson/Zoe Monitoring");
  }
}

async function managementMenu(): Promise<void> {
  const running = isRunning();
  const uptime = getUptime();

  const statusDot = running ? pc.green("●") : pc.red("○");
  const statusLabel = running
    ? `${pc.green("Running")}${uptime ? pc.dim(` (uptime: ${uptime})`) : ""}`
    : pc.red("Stopped");

  console.log(`  Status: ${statusDot} ${statusLabel}\n`);

  // Show health + mode status if running
  if (running) {
    const health = await getHealthStatus();
    if (health) {
      console.log(
        `  ${pc.dim("MQTT:")} ${health.mqtt ? pc.green("connected") : pc.red("disconnected")}  ${pc.dim("Frigate:")} ${health.frigate ? pc.green("connected") : pc.red("disconnected")}`
      );
    }
    const modes = await fetchModes();
    if (modes) {
      console.log(`  ${pc.dim("🏠 Home:")} ${formatModeStatus(modes.home)}  ${pc.dim("🐕 Tyson/Zoe:")} ${formatModeStatus(modes["tyson-zoe"])}`);
    }
    console.log();
  }

  const options = running
    ? [
        { value: "modes", label: "Monitoring Modes", hint: "Toggle or schedule Home / Tyson-Zoe" },
        { value: "stop", label: "Stop monitoring" },
        { value: "reconfigure", label: "Reconfigure", hint: "Edit Telegram / Twilio / network" },
        { value: "dashboard", label: "Open Dashboard" },
        { value: "exit", label: "Exit", hint: "Keep running in background" },
      ]
    : [
        { value: "start", label: "Start monitoring" },
        { value: "reconfigure", label: "Reconfigure", hint: "Edit Telegram / Twilio / network" },
        { value: "uninstall", label: "Uninstall" },
        { value: "exit", label: "Exit" },
      ];

  const action = await p.select({
    message: "What would you like to do?",
    options,
  });

  if (p.isCancel(action) || action === "exit") {
    p.outro(pc.dim("TysonZoeMonitor continues running in the background."));
    process.exit(0);
  }

  const s = p.spinner();

  if (action === "start") {
    // Apply OS-specific networking fixes
    applyPlatformFixes();

    // Check Docker first
    if (!isDockerRunning()) {
      s.start("Starting Docker Desktop...");
      const started = await startDockerDesktop();
      if (!started) {
        s.stop(`${pc.red("✘")} Could not start Docker`);
        process.exit(1);
      }
      s.stop(`${pc.green("✔")} Docker running`);
    }

    // Network check
    s.start("Checking network...");
    try {
      const net = await ensureNetwork();
      s.stop(`${pc.green("✔")} Network OK — Host: ${pc.cyan(net.hostIP)}, DVR: ${pc.cyan(net.dvrIP)}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      s.stop(`${pc.red("✘")} ${errMsg}`);
      process.exit(1);
    }

    console.log(pc.bold("\n  Starting services...\n"));
    await startServices();

    // Ask which monitoring mode to enable
    console.log();
    const modeChoice = await p.select({
      message: "Which monitoring mode?",
      options: [
        { value: "home-manual", label: "Home Monitoring — turn ON now", hint: "Boundary cross (person)" },
        { value: "tyson-manual", label: "Tyson/Zoe Monitoring — turn ON now", hint: "Dog detection" },
        { value: "both-manual", label: "Both — turn ON now" },
        { value: "home-schedule", label: "Home Monitoring — schedule", hint: "Daily time range" },
        { value: "tyson-schedule", label: "Tyson/Zoe Monitoring — schedule", hint: "Daily time range" },
        { value: "skip", label: "Skip — configure later" },
      ],
    });

    if (!p.isCancel(modeChoice) && modeChoice !== "skip") {
      if (modeChoice === "home-manual") {
        await setMode("home", true);
        console.log(`  ${pc.green("✔")} Home Monitoring ${pc.green("ON")}`);
      } else if (modeChoice === "tyson-manual") {
        await setMode("tyson-zoe", true);
        console.log(`  ${pc.green("✔")} Tyson/Zoe Monitoring ${pc.green("ON")}`);
      } else if (modeChoice === "both-manual") {
        await setMode("home", true);
        await setMode("tyson-zoe", true);
        console.log(`  ${pc.green("✔")} Both modes ${pc.green("ON")}`);
      } else if (modeChoice === "home-schedule") {
        await promptSchedule("home", "Home Monitoring");
      } else if (modeChoice === "tyson-schedule") {
        await promptSchedule("tyson-zoe", "Tyson/Zoe Monitoring");
      }
    }

    // Open dashboard + Frigate UI in browser
    const frigatePort = getOS() === "windows" ? 5000 : 5050;
    openInBrowser("http://localhost:3000");
    openInBrowser(`http://localhost:${frigatePort}`);

    p.outro(`${pc.green("✔")} TysonZoeMonitor is running! Dashboard: ${pc.cyan("http://localhost:3000")}`);
    process.exit(0);
  }

  if (action === "stop") {
    s.start("Stopping services...");
    await stopServices();
    s.stop(`${pc.green("✔")} All services stopped`);
    p.outro(pc.dim("Run this command again to restart."));
    process.exit(0);
  }

  if (action === "reconfigure") {
    const config = await collectConfig(true);
    if (config) {
      writeEnv(config);
      console.log(`\n  ${pc.green("✔")} Configuration saved`);
      if (running) {
        s.start("Recreating services with new config...");
        await stopServices();
        await startServices();
        s.stop(`${pc.green("✔")} Services restarted with new config`);
      }
    }
    process.exit(0);
  }

  if (action === "dashboard") {
    openInBrowser("http://localhost:3000");
    p.outro(pc.dim("Opening dashboard in browser..."));
    process.exit(0);
  }

  if (action === "modes") {
    await monitoringModesMenu();
    process.exit(0);
  }

  if (action === "uninstall") {
    const confirm = await p.confirm({
      message: "Remove all containers, images, and data?",
    });
    if (p.isCancel(confirm) || !confirm) {
      p.outro(pc.dim("No changes made."));
      process.exit(0);
    }

    s.start("Stopping and removing containers...");
    try {
      await stopServices();
    } catch {
      // may not be running
    }
    s.stop(`${pc.green("✔")} Containers stopped`);

    s.start("Removing project files...");
    const { rm } = await import("fs/promises");
    try {
      await rm(INSTALL_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
    s.stop(`${pc.green("✔")} Project files removed`);

    p.outro(`${pc.green("✔")} TysonZoeMonitor fully uninstalled. Run ${pc.bold("npx tyson-zoe-monitor")} to reinstall.`);
    process.exit(0);
  }
}

async function main(): Promise<void> {
  console.clear();
  showBanner(getVersion());

  const installed = isProjectInstalled();
  const configured = installed && hasEnv();

  if (!installed || !configured) {
    await firstRunFlow();
  } else {
    await managementMenu();
  }
}

main().catch((err) => {
  console.error(pc.red("Error:"), err.message);
  process.exit(1);
});
