import axios from "axios";
import { DiagnosticReport } from "./diagnostics";

const GITHUB_GIST_TOKEN = process.env.GITHUB_GIST_TOKEN || "";
const GIST_API = "https://api.github.com/gists";
const GIST_FILENAME = "tyson-zoe-diagnostics.json";

let gistId: string | null = null;

/** Find existing diagnostics gist or create a new one */
async function ensureGist(): Promise<string> {
  if (gistId) return gistId;

  const headers = {
    Authorization: `token ${GITHUB_GIST_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
  };

  // Search existing gists for our file
  try {
    const resp = await axios.get(`${GIST_API}?per_page=30`, { headers, timeout: 10000 });
    for (const gist of resp.data) {
      if (gist.files && gist.files[GIST_FILENAME]) {
        gistId = gist.id as string;
        console.log(`[gist] Found existing diagnostics gist: ${gistId}`);
        return gistId;
      }
    }
  } catch (err) {
    console.error("[gist] Failed to list gists:", err instanceof Error ? err.message : err);
  }

  // Create new gist
  try {
    const resp = await axios.post(
      GIST_API,
      {
        description: "TysonZoeMonitor — Remote Diagnostics (auto-updated)",
        public: false,
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify({ status: "initializing" }, null, 2),
          },
        },
      },
      { headers, timeout: 10000 }
    );
    gistId = resp.data.id;
    console.log(`[gist] Created new diagnostics gist: ${gistId}`);
    return gistId!;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to create gist: ${msg}`);
  }
}

/** Push diagnostic report to GitHub Gist */
export async function pushDiagnostics(report: DiagnosticReport): Promise<void> {
  if (!GITHUB_GIST_TOKEN) {
    console.warn("[gist] GITHUB_GIST_TOKEN not set — skipping remote diagnostics push");
    return;
  }

  try {
    const id = await ensureGist();
    await axios.patch(
      `${GIST_API}/${id}`,
      {
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify(report, null, 2),
          },
        },
      },
      {
        headers: {
          Authorization: `token ${GITHUB_GIST_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
        timeout: 10000,
      }
    );
    console.log(`[gist] Diagnostics pushed at ${report.timestamp}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[gist] Failed to push diagnostics: ${msg}`);
  }
}
