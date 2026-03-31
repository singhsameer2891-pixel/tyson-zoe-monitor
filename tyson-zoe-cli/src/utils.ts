import { execaSync } from "execa";
import { platform } from "os";
import { homedir } from "os";
import { join } from "path";
import net from "net";

export const INSTALL_DIR = join(homedir(), "TysonZoeMonitor");
export const REPO_URL =
  "https://github.com/singhsameer2891-pixel/tyson-zoe-monitor.git";

export function getOS(): "mac" | "windows" | "linux" {
  const p = platform();
  if (p === "darwin") return "mac";
  if (p === "win32") return "windows";
  return "linux";
}

export function getLanIP(): string {
  const os = getOS();
  try {
    if (os === "mac") {
      const { stdout } = execaSync("ipconfig", ["getifaddr", "en0"]);
      return stdout.trim();
    } else if (os === "windows") {
      const { stdout } = execaSync("powershell", [
        "-Command",
        "(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Wi-Fi).IPAddress",
      ]);
      return stdout.trim().split("\n")[0] || "localhost";
    } else {
      const { stdout } = execaSync("hostname", ["-I"]);
      return stdout.trim().split(" ")[0] || "localhost";
    }
  } catch {
    return "localhost";
  }
}

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port, "0.0.0.0");
  });
}

export function openInBrowser(url: string): void {
  const os = getOS();
  try {
    if (os === "mac") {
      execaSync("open", [url]);
    } else if (os === "windows") {
      execaSync("cmd", ["/c", "start", url]);
    } else {
      execaSync("xdg-open", [url]);
    }
  } catch {
    // silently fail — user can open manually
  }
}
