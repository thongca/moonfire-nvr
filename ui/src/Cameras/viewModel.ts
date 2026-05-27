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
