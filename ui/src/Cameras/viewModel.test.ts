import { describe, expect, test } from "vitest";
import {
  cameraRecordingStatus,
  formatRetentionBytes,
  parseRetentionBytes,
  retentionSummary,
} from "./viewModel";
import type * as api from "../api";

type StreamWithRetention = api.StreamAdminEntry & {
  retainBytes: number;
  flushIfSec: number;
};

const camera = (streams: StreamWithRetention[]): api.CameraAdminEntry => ({
  id: 1,
  uuid: "camera-1",
  shortName: "Camera 1",
  description: "",
  hasCredentials: false,
  streams,
});

const stream = (overrides: Partial<StreamWithRetention>): StreamWithRetention => ({
  id: 1,
  type: "main",
  mode: "",
  rtspTransport: "",
  retainBytes: 0,
  flushIfSec: 0,
  ...overrides,
});

describe("retention helpers", () => {
  test("parses human retention sizes", () => {
    expect(parseRetentionBytes("0")).toEqual({ ok: true, bytes: 0 });
    expect(parseRetentionBytes("500 MB")).toEqual({ ok: true, bytes: 500_000_000 });
    expect(parseRetentionBytes("50 GB")).toEqual({ ok: true, bytes: 50_000_000_000 });
    expect(parseRetentionBytes("1 TB")).toEqual({ ok: true, bytes: 1_000_000_000_000 });
  });

  test("rejects invalid retention sizes", () => {
    expect(parseRetentionBytes("abc")).toEqual({
      ok: false,
      message: "Enter a size like 50 GB, 1 TB, 500 MB, or 0.",
    });
    expect(parseRetentionBytes("-1 GB")).toEqual({
      ok: false,
      message: "Retention limit cannot be negative.",
    });
  });

  test("formats retention bytes", () => {
    expect(formatRetentionBytes(0)).toBe("Unlimited");
    expect(formatRetentionBytes(50_000_000_000)).toBe("50 GB");
  });
});

describe("camera recording status", () => {
  test("marks record mode without storage as needs storage", () => {
    expect(cameraRecordingStatus(camera([stream({ mode: "record" })]))).toEqual({
      label: "Needs storage",
      color: "warning",
      detail: "main: select a storage directory",
    });
  });

  test("marks configured recording as waiting for frames", () => {
    expect(
      cameraRecordingStatus(
        camera([stream({ mode: "record", sampleFileDirId: 7 })]),
      ),
    ).toEqual({
      label: "Waiting for frames",
      color: "warning",
      detail: "main: configured, no frames yet",
    });
  });

  test("prioritizes any recording stream that needs storage", () => {
    expect(
      cameraRecordingStatus(
        camera([
          stream({ mode: "record", sampleFileDirId: 7 }),
          stream({ id: 2, type: "sub", mode: "record" }),
        ]),
      ),
    ).toEqual({
      label: "Needs storage",
      color: "warning",
      detail: "sub: select a storage directory",
    });
  });

  test("summarizes retention", () => {
    expect(retentionSummary(camera([]))).toBe("—");
    expect(retentionSummary(camera([stream({ mode: "record", retainBytes: 0 })]))).toBe("Unlimited");
    expect(
      retentionSummary(
        camera([stream({ mode: "record", retainBytes: 50_000_000_000 })]),
      ),
    ).toBe("50 GB limit");
  });

  test("summarizes multi-stream retention as unlimited when any recording stream is unlimited", () => {
    expect(
      retentionSummary(
        camera([
          stream({ mode: "record", retainBytes: 50_000_000_000 }),
          stream({ id: 2, type: "sub", mode: "record", retainBytes: 0 }),
        ]),
      ),
    ).toBe("Unlimited");
    expect(
      retentionSummary(
        camera([
          stream({ mode: "record", retainBytes: 50_000_000_000 }),
          stream({ id: 2, type: "sub", mode: "record", retainBytes: 25_000_000_000 }),
        ]),
      ),
    ).toBe("75 GB limit");
  });
});
