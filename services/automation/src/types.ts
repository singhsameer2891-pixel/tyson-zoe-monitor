export interface TimeRestriction {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

export interface Rule {
  id: string;
  name: string;
  camera: string;
  zone: string;
  objectType: "dog" | "person" | "cat";
  action: "entered" | "exited";
  timeRestriction: TimeRestriction;
  notificationTemplate: string;
  enabled: boolean;
  mode: "home" | "tyson-zoe";
}

/** Frigate MQTT event payload (subset of fields we use) */
export interface FrigateEvent {
  id: string;
  camera: string;
  label: string;
  zones: string[];
  type: "new" | "update" | "end";
  after: {
    id: string;
    camera: string;
    label: string;
    current_zones: string[];
    entered_zones: string[];
    top_score: number;
    has_snapshot: boolean;
    has_clip: boolean;
    start_time: number;
    end_time: number | null;
  };
  before: {
    id: string;
    camera: string;
    label: string;
    current_zones: string[];
    entered_zones: string[];
    top_score: number;
    has_snapshot: boolean;
    has_clip: boolean;
    start_time: number;
    end_time: number | null;
  };
}

export interface EventLogEntry {
  id?: number;
  event_id: string;
  camera: string;
  zone: string;
  object_type: string;
  rule_id: string | null;
  rule_name: string | null;
  notified: boolean;
  snapshot_path: string | null;
  timestamp: string;
}

export interface HealthStatus {
  mqtt: boolean;
  frigate: boolean;
  uptime: number;
}
