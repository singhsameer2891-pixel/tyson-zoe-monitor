import { execaSync, execa } from "execa";
import { existsSync } from "fs";
import { INSTALL_DIR, REPO_URL, getOS, openInBrowser } from "./utils.js";

export function isDockerInstalled(): boolean {
  try {
    execaSync("docker", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

export function isDockerRunning(): boolean {
  try {
    execaSync("docker", ["info"], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

export function getDockerInstallUrl(): string {
  const os = getOS();
  if (os === "mac") return "https://docs.docker.com/desktop/setup/install/mac-install/";
  if (os === "windows") return "https://docs.docker.com/desktop/setup/install/windows-install/";
  return "https://docs.docker.com/engine/install/";
}

export async function startDockerDesktop(): Promise<boolean> {
  const os = getOS();
  try {
    if (os === "mac") {
      await execa("open", ["-a", "Docker"]);
    } else if (os === "windows") {
      await execa("cmd", ["/c", "start", "", "Docker Desktop"]);
    }
    // Wait for Docker to be ready
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      if (isDockerRunning()) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function isProjectInstalled(): boolean {
  return existsSync(INSTALL_DIR) && existsSync(`${INSTALL_DIR}/docker-compose.yml`);
}

export async function cloneProject(): Promise<void> {
  if (existsSync(INSTALL_DIR)) {
    // Stash any local changes (e.g. user-modified frigate.yml), pull latest, then re-apply
    try {
      await execa("git", ["-C", INSTALL_DIR, "stash"], { timeout: 10000 });
    } catch {
      // nothing to stash — fine
    }
    await execa("git", ["-C", INSTALL_DIR, "pull", "--ff-only"], {
      timeout: 60000,
    });
    try {
      await execa("git", ["-C", INSTALL_DIR, "stash", "pop"], { timeout: 10000 });
    } catch {
      // stash pop conflict — remote changes win, local changes dropped
      await execa("git", ["-C", INSTALL_DIR, "checkout", "."], { timeout: 10000 });
      await execa("git", ["-C", INSTALL_DIR, "stash", "drop"], { timeout: 10000 }).catch(() => {});
    }
  } else {
    await execa("git", ["clone", REPO_URL, INSTALL_DIR], {
      timeout: 120000,
    });
  }
}

export function guideDockerInstall(): void {
  const url = getDockerInstallUrl();
  console.log(`\n  Opening Docker Desktop download page...\n`);
  openInBrowser(url);
}
