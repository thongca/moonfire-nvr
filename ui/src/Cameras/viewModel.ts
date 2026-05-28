import * as api from "../api";

export function cameraIp(camera: api.CameraAdminEntry): string {
  if (camera.onvifBaseUrl === undefined || camera.onvifBaseUrl === "") {
    return "—";
  }
  try {
    return new URL(camera.onvifBaseUrl).hostname;
  } catch {
    return camera.onvifBaseUrl;
  }
}

export function cameraStatus(camera: api.CameraAdminEntry): {
  label: string;
  color: "success" | "danger";
} {
  const recording = camera.streams.some((stream) => stream.mode === "record");
  return recording
    ? { label: "Online", color: "success" }
    : { label: "Offline", color: "danger" };
}

export function streamBadgeLabel(stream: api.StreamAdminEntry): string {
  return `${stream.type.toUpperCase()} REC`;
}

export function storageLabel(camera: api.CameraAdminEntry): string {
  const stream = camera.streams.find(
    (entry) => entry.sampleFileDirId !== undefined && entry.sampleFileDirId !== null,
  );
  if (stream === undefined) {
    return "—";
  }
  return `Dir ${stream.sampleFileDirId}`;
}

export type RetentionParseResult =
  | { ok: true; bytes: number }
  | { ok: false; message: string };

type StreamRetentionFields = api.StreamAdminEntry & {
  retainBytes?: number;
  flushIfSec?: number;
};

export function parseRetentionBytes(input: string): RetentionParseResult {
  const trimmed = input.trim();
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*(b|bytes?|kb|mb|gb|tb)?$/i);
  if (match === null) {
    return {
      ok: false,
      message: "Enter a size like 50 GB, 1 TB, 500 MB, or 0.",
    };
  }

  const value = Number(match[1]);
  if (value < 0) {
    return { ok: false, message: "Retention limit cannot be negative." };
  }

  const unit = (match[2] ?? "b").toLowerCase();
  const multiplier =
    unit === "tb"
      ? 1_000_000_000_000
      : unit === "gb"
        ? 1_000_000_000
        : unit === "mb"
          ? 1_000_000
          : unit === "kb"
            ? 1_000
            : 1;
  return { ok: true, bytes: Math.round(value * multiplier) };
}

export function formatRetentionBytes(bytes: number): string {
  if (bytes === 0) {
    return "Unlimited";
  }

  const units: Array<[string, number]> = [
    ["TB", 1_000_000_000_000],
    ["GB", 1_000_000_000],
    ["MB", 1_000_000],
    ["KB", 1_000],
  ];
  for (const [unit, size] of units) {
    if (bytes >= size && bytes % size === 0) {
      return `${bytes / size} ${unit}`;
    }
    if (bytes >= size) {
      return `${(bytes / size).toFixed(1)} ${unit}`;
    }
  }
  return `${bytes} bytes`;
}

export function retentionSummary(camera: api.CameraAdminEntry): string {
  const recording = camera.streams.filter((stream) => stream.mode === "record");
  if (recording.length === 0) {
    return "—";
  }

  if (
    recording.some(
      (stream) => ((stream as StreamRetentionFields).retainBytes ?? 0) === 0,
    )
  ) {
    return "Unlimited";
  }

  const total = recording.reduce(
    (sum, stream) => sum + ((stream as StreamRetentionFields).retainBytes ?? 0),
    0,
  );
  return `${formatRetentionBytes(total)} limit`;
}

export function cameraRecordingStatus(camera: api.CameraAdminEntry): {
  label: string;
  color: "success" | "warning" | "danger";
  detail: string;
} {
  const recording = camera.streams.filter((stream) => stream.mode === "record");
  if (recording.length === 0) {
    return { label: "Not configured", color: "danger", detail: "No streams recording" };
  }

  const missingStorage = recording.find(
    (stream) => stream.sampleFileDirId === undefined || stream.sampleFileDirId === null,
  );
  if (missingStorage !== undefined) {
    return {
      label: "Needs storage",
      color: "warning",
      detail: `${missingStorage.type}: select a storage directory`,
    };
  }
  return {
    label: "Waiting for frames",
    color: "warning",
    detail: `${recording[0].type}: configured, no frames yet`,
  };
}
