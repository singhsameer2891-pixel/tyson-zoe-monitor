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
import {
  startServices,
  stopServices,
  isRunning,
  getUptime,
  showLogs,
  getHealthStatus,
} from "./services.js";
import { openInBrowser, INSTALL_DIR } from "./utils.js";

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

  // Step 3: Configuration
  const config = await collectConfig();
  if (!config) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
  writeEnv(config);
  console.log(`  ${pc.green("✔")} Configuration saved\n`);

  // Step 4: Start services
  console.log(pc.bold("  Starting services...\n"));
  try {
    await startServices();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(pc.red(`\n  Failed to start services: ${errMsg}`));
    console.error(pc.dim(`  Check logs: docker compose -f ${INSTALL_DIR}/docker-compose.yml logs`));
    process.exit(1);
  }

  // Step 5: Health check
  const health = await getHealthStatus();

  console.log();
  const box = [
    "",
    `  ${pc.green("╔══════════════════════════════════════════════╗")}`,
    `  ${pc.green("║")}  ${pc.bold("🎉 TysonZoeMonitor is running!")}              ${pc.green("║")}`,
    `  ${pc.green("║")}                                              ${pc.green("║")}`,
    `  ${pc.green("║")}  Dashboard:  ${pc.cyan("http://localhost:3000")}            ${pc.green("║")}`,
    `  ${pc.green("║")}  Frigate UI: ${pc.cyan("http://localhost:5001")}            ${pc.green("║")}`,
    `  ${pc.green("║")}  MQTT:       ${health?.mqtt ? pc.green("connected") : pc.red("disconnected")}                     ${pc.green("║")}`,
    `  ${pc.green("║")}  Frigate:    ${health?.frigate ? pc.green("connected") : pc.red("disconnected")}                     ${pc.green("║")}`,
    `  ${pc.green("║")}                                              ${pc.green("║")}`,
    `  ${pc.green("║")}  Run ${pc.bold("npx tyson-zoe-monitor")} again to manage.   ${pc.green("║")}`,
    `  ${pc.green("╚══════════════════════════════════════════════╝")}`,
    "",
  ].join("\n");
  console.log(box);
}

async function managementMenu(): Promise<void> {
  const running = isRunning();
  const uptime = getUptime();

  const statusDot = running ? pc.green("●") : pc.red("○");
  const statusLabel = running
    ? `${pc.green("Running")}${uptime ? pc.dim(` (uptime: ${uptime})`) : ""}`
    : pc.red("Stopped");

  console.log(`  Status: ${statusDot} ${statusLabel}\n`);

  // Show health info if running
  if (running) {
    const health = await getHealthStatus();
    if (health) {
      console.log(
        `  ${pc.dim("MQTT:")} ${health.mqtt ? pc.green("connected") : pc.red("disconnected")}  ${pc.dim("Frigate:")} ${health.frigate ? pc.green("connected") : pc.red("disconnected")}\n`
      );
    }
  }

  const options = running
    ? [
        { value: "stop", label: "Stop monitoring", hint: "docker compose down" },
        { value: "reconfigure", label: "Reconfigure", hint: "Edit Telegram / network settings" },
        { value: "dashboard", label: "Open Dashboard", hint: "http://localhost:3000" },
        { value: "frigate", label: "Open Frigate UI", hint: "http://localhost:5001" },
        { value: "logs", label: "View logs", hint: "Live automation + detection logs" },
        { value: "exit", label: "Exit", hint: "Keep running in background" },
      ]
    : [
        { value: "start", label: "Start monitoring", hint: "docker compose up" },
        { value: "reconfigure", label: "Reconfigure", hint: "Edit Telegram / network settings" },
        { value: "uninstall", label: "Uninstall", hint: "Remove all containers and data" },
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

    console.log(pc.bold("\n  Starting services...\n"));
    await startServices();
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
    const config = await collectConfig();
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

  if (action === "frigate") {
    openInBrowser("http://localhost:5001");
    p.outro(pc.dim("Opening Frigate UI in browser..."));
    process.exit(0);
  }

  if (action === "logs") {
    await showLogs();
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
    s.stop(`${pc.green("✔")} Containers removed`);
    p.note(
      `Project files remain at: ${INSTALL_DIR}\nDelete manually if you want to remove everything.`,
      "Cleanup"
    );
    p.outro(`${pc.green("✔")} TysonZoeMonitor uninstalled`);
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
