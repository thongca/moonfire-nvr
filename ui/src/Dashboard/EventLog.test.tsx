// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { screen, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterAll, afterEach, expect, test, vi } from "vitest";
import EventLog from "./EventLog";
import { renderWithCtx } from "../testutil";
import type { Camera } from "../types";

// Freeze time so time-ago values are deterministic.
// startTime90k for a recording 5 minutes ago:
// Date.now() is mocked to 1_000_000_000_000 ms
const NOW_MS = 1_000_000_000_000;
const NOW_90K = Math.floor((NOW_MS / 1000) * 90000);
const FIVE_MIN_AGO_90K = NOW_90K - 5 * 60 * 90000;

const CAMERA_A: Camera = {
  uuid: "aaaaaaaa-0000-0000-0000-000000000001",
  shortName: "Front Door",
  description: "",
  streams: {
    main: {
      camera: null as any,
      id: 1,
      streamType: "main",
      retainBytes: 1000000,
      minStartTime90k: 0,
      maxEndTime90k: NOW_90K,
      totalDuration90k: 1000,
      totalSampleFileBytes: 1000,
      fsBytes: 1000,
      days: {},
      record: true,
    },
  },
};

const CAMERA_B: Camera = {
  uuid: "bbbbbbbb-0000-0000-0000-000000000002",
  shortName: "Back Gate",
  description: "",
  streams: {
    main: {
      camera: null as any,
      id: 2,
      streamType: "main",
      retainBytes: 1000000,
      minStartTime90k: 0,
      maxEndTime90k: NOW_90K,
      totalDuration90k: 1000,
      totalSampleFileBytes: 1000,
      fsBytes: 1000,
      days: {},
      record: true,
    },
  },
};

const RECORDING_5MIN: import("../api").Recording = {
  startId: 1,
  openId: 1,
  runStartId: 1,
  startTime90k: FIVE_MIN_AGO_90K,
  endTime90k: FIVE_MIN_AGO_90K + 60 * 90000,
  videoSampleEntryId: 1,
  videoSamples: 1860,
  sampleFileBytes: 100000,
};

const server = setupServer();

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW_MS);
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  vi.useRealTimers();
  server.close();
});

test("shows loading state then recordings", async () => {
  server.use(
    http.get(
      `/api/cameras/${CAMERA_A.uuid}/main/recordings`,
      () =>
        HttpResponse.json({
          recordings: [RECORDING_5MIN],
          videoSampleEntries: { 1: { width: 1920, height: 1080 } },
        }),
    ),
  );

  renderWithCtx(<EventLog cameras={[CAMERA_A]} />);

  // After data loads, recording event is visible.
  expect(await screen.findByText("Front Door")).toBeInTheDocument();
  expect(screen.getByText("REC")).toBeInTheDocument();
  expect(screen.getByText("-5m")).toBeInTheDocument();
});

test("shows no recordings message when empty", async () => {
  server.use(
    http.get(
      `/api/cameras/${CAMERA_A.uuid}/main/recordings`,
      () =>
        HttpResponse.json({ recordings: [], videoSampleEntries: {} }),
    ),
  );

  renderWithCtx(<EventLog cameras={[CAMERA_A]} />);
  expect(await screen.findByText("No recent recordings")).toBeInTheDocument();
});

test("shows warning icon on fetch error, keeps stale data", async () => {
  // First fetch: success.
  server.use(
    http.get(
      `/api/cameras/${CAMERA_A.uuid}/main/recordings`,
      () =>
        HttpResponse.json({
          recordings: [RECORDING_5MIN],
          videoSampleEntries: { 1: { width: 1920, height: 1080 } },
        }),
    ),
  );

  renderWithCtx(<EventLog cameras={[CAMERA_A]} />);
  await screen.findByText("Front Door");

  // Second fetch: error.
  server.use(
    http.get(
      `/api/cameras/${CAMERA_A.uuid}/main/recordings`,
      () => HttpResponse.text("server error", { status: 500 }),
    ),
  );

  // Advance 30 seconds to trigger the poll.
  await act(async () => {
    vi.advanceTimersByTime(30_000);
  });

  // Old data still visible.
  expect(screen.getByText("Front Door")).toBeInTheDocument();
  // Warning icon rendered (aria-label).
  expect(screen.getByLabelText("fetch error")).toBeInTheDocument();
});

test("shows at most 8 events across multiple cameras", async () => {
  // Camera A: 5 recordings. Camera B: 5 recordings.
  // EventLog should show only 8.
  const makeRecs = (n: number): import("../api").Recording[] =>
    Array.from({ length: n }, (_, i) => ({
      startId: i + 1,
      openId: 1,
      runStartId: 1,
      startTime90k: FIVE_MIN_AGO_90K - i * 60 * 90000,
      endTime90k: FIVE_MIN_AGO_90K - i * 60 * 90000 + 60 * 90000,
      videoSampleEntryId: 1,
      videoSamples: 1860,
      sampleFileBytes: 100000,
    }));

  server.use(
    http.get(
      `/api/cameras/${CAMERA_A.uuid}/main/recordings`,
      () =>
        HttpResponse.json({
          recordings: makeRecs(5),
          videoSampleEntries: { 1: { width: 1920, height: 1080 } },
        }),
    ),
    http.get(
      `/api/cameras/${CAMERA_B.uuid}/main/recordings`,
      () =>
        HttpResponse.json({
          recordings: makeRecs(5),
          videoSampleEntries: { 1: { width: 1920, height: 1080 } },
        }),
    ),
  );

  renderWithCtx(<EventLog cameras={[CAMERA_A, CAMERA_B]} />);

  // Wait for data to load (multiple "Front Door" entries expected).
  await screen.findAllByText("Front Door");

  // Count "REC" badges — should be exactly 8.
  const recBadges = screen.getAllByText("REC");
  expect(recBadges).toHaveLength(8);
});

test("VIEW FULL LOG links to /archive", async () => {
  server.use(
    http.get(
      `/api/cameras/${CAMERA_A.uuid}/main/recordings`,
      () => HttpResponse.json({ recordings: [], videoSampleEntries: {} }),
    ),
  );

  renderWithCtx(<EventLog cameras={[CAMERA_A]} />);
  await screen.findByText("No recent recordings");

  const link = screen.getByRole("link", { name: /VIEW FULL LOG/i });
  expect(link).toHaveAttribute("href", "/archive");
});
