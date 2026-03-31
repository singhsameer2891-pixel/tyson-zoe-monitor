import Database from "better-sqlite3";
import path from "path";
import { EventLogEntry } from "./types";

const DB_PATH = process.env.DB_PATH || path.resolve("/data/events.db");

let db: Database.Database;

export function initDatabase(): void {
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      camera TEXT NOT NULL,
      zone TEXT NOT NULL,
      object_type TEXT NOT NULL,
      rule_id TEXT,
      rule_name TEXT,
      notified INTEGER NOT NULL DEFAULT 0,
      snapshot_path TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_camera ON events(camera)
  `);
}

export function logEvent(entry: Omit<EventLogEntry, "id">): number {
  const stmt = db.prepare(`
    INSERT INTO events (event_id, camera, zone, object_type, rule_id, rule_name, notified, snapshot_path, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    entry.event_id,
    entry.camera,
    entry.zone,
    entry.object_type,
    entry.rule_id,
    entry.rule_name,
    entry.notified ? 1 : 0,
    entry.snapshot_path,
    entry.timestamp || new Date().toISOString()
  );
  return result.lastInsertRowid as number;
}

export interface EventQuery {
  limit?: number;
  camera?: string;
  object_type?: string;
  from?: string;
  to?: string;
}

export function getEvents(query: EventQuery = {}): EventLogEntry[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.camera) {
    conditions.push("camera = ?");
    params.push(query.camera);
  }
  if (query.object_type) {
    conditions.push("object_type = ?");
    params.push(query.object_type);
  }
  if (query.from) {
    conditions.push("timestamp >= ?");
    params.push(query.from);
  }
  if (query.to) {
    conditions.push("timestamp <= ?");
    params.push(query.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = query.limit || 50;

  const stmt = db.prepare(`
    SELECT id, event_id, camera, zone, object_type, rule_id, rule_name,
           notified, snapshot_path, timestamp
    FROM events ${where}
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  const rows = stmt.all(...params, limit) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: row.id as number,
    event_id: row.event_id as string,
    camera: row.camera as string,
    zone: row.zone as string,
    object_type: row.object_type as string,
    rule_id: row.rule_id as string | null,
    rule_name: row.rule_name as string | null,
    notified: Boolean(row.notified),
    snapshot_path: row.snapshot_path as string | null,
    timestamp: row.timestamp as string,
  }));
}

export function getDatabase(): Database.Database {
  return db;
}
