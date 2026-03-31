import { execa, execaSync } from "execa";
import { Listr } from "listr2";
import pc from "picocolors";
import { INSTALL_DIR } from "./utils.js";

const COMPOSE_OPTS = { cwd: INSTALL_DIR };

interface ServiceStatus {
  name: string;
  state: string;
  status: string;
}

export function getServiceStatuses(): ServiceStatus[] {
  try {
    const { stdout } = execaSync(
      "docker",
      ["compose", "ps", "--format", "json"],
      COMPOSE_OPTS
    );
    const services: ServiceStatus[] = [];
    for (const line of stdout.trim().split("\n")) {
      if (!line.trim()) continue;
      try {
        const svc = JSON.parse(line);
        services.push({
          name: svc.Name || svc.Service || "unknown",
          state: svc.State || "unknown",
          status: svc.Status || "",
        });
      } catch {
        continue;
      }
    }
    return services;
  } catch {
    return [];
  }
}

export function isRunning(): boolean {
  const services = getServiceStatuses();
  return services.length > 0 && services.every((s) => s.state === "running");
}

export function getUptime(): string {
  const services = getServiceStatuses();
  if (services.length === 0) return "";
  const status = services[0]?.status || "";
  const match = status.match(/Up (.+)/);
  return match ? match[1] : "";
}

export async function startServices(): Promise<void> {
  const tasks = new Listr(
    [
      {
        title: "Cleaning up stale containers",
        task: async () => {
          // Remove any conflicting containers from previous installs
          const names = ["cctv-mosquitto", "cctv-frigate", "cctv-automation", "cctv-dashboard"];
          for (const name of names) {
            try {
              await execa("docker", ["rm", "-f", name], { timeout: 10000 });
            } catch {
              // container doesn't exist — fine
            }
          }
        },
      },
      {
        title: "Pulling Docker images",
        task: async () => {
          await execa("docker", ["compose", "pull"], {
            ...COMPOSE_OPTS,
            timeout: 600000,
          });
        },
      },
      {
        title: "Pruning stale build cache",
        task: async () => {
          try {
            await execa("docker", ["builder", "prune", "-f"], { timeout: 30000 });
          } catch {
            // non-critical — proceed even if prune fails
          }
        },
      },
      {
        title: "Building custom images",
        task: async () => {
          await execa("docker", ["compose", "build"], {
            ...COMPOSE_OPTS,
            timeout: 600000,
          });
        },
      },
      {
        title: "Starting services",
        task: async () => {
          await execa("docker", ["compose", "up", "-d"], {
            ...COMPOSE_OPTS,
            timeout: 120000,
          });
        },
      },
      {
        title: "Waiting for services to be healthy",
        task: async () => {
          // Wait up to 30s for health endpoint
          for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            try {
              const resp = await fetch("http://localhost:4000/api/health", {
                signal: AbortSignal.timeout(3000),
              });
              if (resp.ok) return;
            } catch {
              // keep waiting
            }
          }
          throw new Error("Services did not become healthy within 30 seconds");
        },
      },
    ],
    { concurrent: false, rendererOptions: { collapseErrors: false } }
  );

  await tasks.run();
}

export async function stopServices(): Promise<void> {
  await execa("docker", ["compose", "down"], {
    ...COMPOSE_OPTS,
    timeout: 60000,
  });
}

export async function showLogs(): Promise<void> {
  const proc = execa("docker", ["compose", "logs", "-f", "--tail", "50"], {
    ...COMPOSE_OPTS,
    stdio: "inherit",
  });

  console.log(pc.dim("\n  Press Ctrl+C to stop viewing logs.\n"));

  try {
    await proc;
  } catch {
    // Ctrl+C triggers this — expected
  }
}

export async function getHealthStatus(): Promise<{
  mqtt: boolean;
  frigate: boolean;
  uptime: number;
} | null> {
  try {
    const resp = await fetch("http://localhost:4000/api/health", {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) return (await resp.json()) as { mqtt: boolean; frigate: boolean; uptime: number };
  } catch {
    // not reachable
  }
  return null;
}
