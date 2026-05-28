// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import DashboardActivity from "./Dashboard";
import { formatBytes } from "./format";
import { FrameProps } from "./App";
import { renderWithCtx } from "./testutil";
import type * as api from "./api";
import type { Camera, Stream } from "./types";

const Frame = ({ children }: FrameProps) => <>{children}</>;

const server = setupServer(
  http.get("/api/system/process-telemetry", () =>
    HttpResponse.json({
      sampledAtUnixMs: 1_000_000_000_000,
      pid: 42,
      memory: { status: "unavailable", reason: "not supported" },
      io: { status: "unavailable", reason: "not supported" },
      network: { status: "unavailable", reason: "not supported" },
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeToplevelFixture(): api.ToplevelResponse {
  const frontDoor = {
    uuid: "front-door",
    shortName: "Front Door",
    description: "Entrance",
    streams: {},
  } satisfies Camera;

  const garage = {
    uuid: "garage",
    shortName: "Garage",
    description: "Garage",
    streams: {},
  } satisfies Camera;

  const mainStream: Stream = {
    camera: frontDoor,
    id: 1,
    streamType: "main",
    retainBytes: 1000,
    minStartTime90k: 0,
    maxEndTime90k: 90_000,
    totalDuration90k: 90_000,
    totalSampleFileBytes: 1000,
    fsBytes: 2300,
    days: {},
    record: true,
    numRecentRecordings: 0,
    numRecentFrames: 0,
    recentFrameBytes: 0,
  };

  const subStream: Stream = {
    camera: frontDoor,
    id: 2,
    streamType: "sub",
    retainBytes: 1000,
    minStartTime90k: 0,
    maxEndTime90k: 90_000,
    totalDuration90k: 90_000,
    totalSampleFileBytes: 1000,
    fsBytes: 1000,
    days: {},
    record: false,
    numRecentRecordings: 0,
    numRecentFrames: 0,
    recentFrameBytes: 0,
  };

  frontDoor.streams = {
    main: mainStream,
    sub: subStream,
  };

  return {
    timeZoneName: "UTC",
    serverVersion: "0.0.0",
    cameras: [frontDoor, garage],
    streams: new Map([
      [mainStream.id, mainStream],
      [subStream.id, subStream],
    ]),
    permissions: {
      adminUsers: true,
      readCameraConfigs: true,
      updateSignals: true,
      viewVideo: true,
    },
    user: undefined,
  };
}

test("shows Dashboard Command Center overview telemetry", async () => {
  renderWithCtx(
    <DashboardActivity toplevel={makeToplevelFixture()} Frame={Frame} />,
  );

  expect(
    screen.getByRole("heading", { name: "System Overview" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Infrastructure monitoring and recording telemetry"),
  ).toBeInTheDocument();
  expect(screen.getByText(/Live Sync/i)).toBeInTheDocument();

  const camerasMetric = screen.getByText("Cameras").closest("article");
  expect(camerasMetric).not.toBeNull();
  expect(within(camerasMetric!).getByText("2")).toBeInTheDocument();

  const recordingLoadMetric = screen
    .getByText("Recording Load")
    .closest("article");
  expect(recordingLoadMetric).not.toBeNull();
  expect(within(recordingLoadMetric!).getByText("50%")).toBeInTheDocument();
  expect(
    within(recordingLoadMetric!).getByText("1 / 2 recording"),
  ).toBeInTheDocument();

  const storageUsedMetric = screen.getByText("Storage Used").closest("article");
  expect(storageUsedMetric).not.toBeNull();
  expect(within(storageUsedMetric!).getByText("3.3 KB")).toBeInTheDocument();
  expect(
    within(storageUsedMetric!).getByText("2.0 KB recorded samples"),
  ).toBeInTheDocument();

  const memoryMetric = screen.getByText("Process Memory").closest("article");
  expect(memoryMetric).not.toBeNull();
  expect(within(memoryMetric!).getByText("Pending")).toBeInTheDocument();
  expect(
    await within(memoryMetric!).findByText("Process telemetry unavailable"),
  ).toBeInTheDocument();
  expect(within(memoryMetric!).getByText("Unavailable")).toBeInTheDocument();
  expect(
    within(memoryMetric!).queryByText("Process telemetry pending"),
  ).not.toBeInTheDocument();

  const ioMetric = screen.getByText("Recorder I/O").closest("article");
  expect(ioMetric).not.toBeNull();
  expect(within(ioMetric!).getByText("Unavailable")).toBeInTheDocument();
  expect(
    within(ioMetric!).getByText("Network telemetry unavailable"),
  ).toBeInTheDocument();
  expect(within(ioMetric!).queryByText("1 idle")).not.toBeInTheDocument();
  expect(
    within(ioMetric!).queryByText("1 camera without active recording"),
  ).not.toBeInTheDocument();
});

test("shows process telemetry when available", async () => {
  server.use(
    http.get("/api/system/process-telemetry", () =>
      HttpResponse.json({
        sampledAtUnixMs: 1_000_000_000_000,
        pid: 42,
        memory: {
          status: "available",
          residentBytes: 2_147_483_648,
          virtualBytes: 5_368_709_120,
        },
        io: {
          status: "available",
          readBytesPerSec: 120_000,
          writeBytesPerSec: 5_400_000,
          totalReadBytes: 987_654_321,
          totalWriteBytes: 1_234_567_890,
        },
        network: { status: "unavailable", reason: "not supported" },
      }),
    ),
  );

  renderWithCtx(
    <DashboardActivity toplevel={makeToplevelFixture()} Frame={Frame} />,
  );

  const memoryMetric = screen.getByText("Process Memory");
  expect(
    await within(memoryMetric.closest("article")!).findByText("2.1 GB"),
  ).toBeInTheDocument();

  const ioMetric = screen.getByText("Recorder I/O");
  expect(
    within(ioMetric.closest("article")!).getByText(/5\.4 MB\/s write/),
  ).toBeInTheDocument();
  expect(screen.getByText("Network telemetry unavailable")).toBeInTheDocument();
});

test("keeps dashboard visible when process telemetry request fails", async () => {
  server.use(
    http.get("/api/system/process-telemetry", () =>
      HttpResponse.text("telemetry failed", { status: 500 }),
    ),
  );

  renderWithCtx(
    <DashboardActivity toplevel={makeToplevelFixture()} Frame={Frame} />,
  );

  expect(
    screen.getByRole("heading", { name: "System Overview" }),
  ).toBeInTheDocument();
  expect(
    await screen.findByText("Process telemetry unavailable"),
  ).toBeInTheDocument();
});

test("shows priority feed cards", () => {
  renderWithCtx(
    <DashboardActivity toplevel={makeToplevelFixture()} Frame={Frame} />,
  );

  expect(
    screen.getByRole("heading", { name: "Priority Feeds" }),
  ).toBeInTheDocument();

  const frontDoorCard = screen.getByTestId("feed-card-front-door");
  expect(within(frontDoorCard).getByText("Front Door")).toBeInTheDocument();
  expect(
    within(frontDoorCard).getByText("No recent recording"),
  ).toBeInTheDocument();
  expect(
    within(frontDoorCard).getByText("1 recording stream"),
  ).toBeInTheDocument();
  expect(
    within(frontDoorCard).getByRole("link", {
      name: "Open archive for Front Door",
    }),
  ).toHaveAttribute("href", "/archive");
  expect(
    within(frontDoorCard).getByRole("link", {
      name: "Manage Front Door from priority feed",
    }),
  ).toHaveAttribute("href", "/cameras");

  const garageCard = screen.getByTestId("feed-card-garage");
  expect(
    within(garageCard).getByRole("heading", { name: "Garage" }),
  ).toBeInTheDocument();
  expect(
    within(garageCard).getByText("No recent recording"),
  ).toBeInTheDocument();
  expect(
    within(garageCard).getByText("0 recording streams"),
  ).toBeInTheDocument();
  expect(
    within(garageCard).getByRole("link", {
      name: "Open archive for Garage",
    }),
  ).toHaveAttribute("href", "/archive");
  expect(
    within(garageCard).getByRole("link", {
      name: "Manage Garage from priority feed",
    }),
  ).toHaveAttribute("href", "/cameras");
});

test("shows quick management stream status", () => {
  renderWithCtx(
    <DashboardActivity toplevel={makeToplevelFixture()} Frame={Frame} />,
  );

  expect(
    screen.getByRole("heading", { name: "Quick Management" }),
  ).toBeInTheDocument();

  const quickManagement = screen.getByTestId("quick-management");
  expect(within(quickManagement).getByText("Front Door")).toBeInTheDocument();
  expect(
    within(quickManagement).getByText("1 active / 2 streams"),
  ).toBeInTheDocument();
  expect(within(quickManagement).getByText("Garage")).toBeInTheDocument();
  expect(
    within(quickManagement).getByText("0 active / 0 streams"),
  ).toBeInTheDocument();

  expect(
    within(quickManagement).getByRole("link", {
      name: "Manage Front Door from quick management",
    }),
  ).toHaveAttribute("href", "/cameras");
  expect(
    within(quickManagement).getByRole("link", {
      name: "Manage Garage from quick management",
    }),
  ).toHaveAttribute("href", "/cameras");
});

test("shows activity report placeholder", () => {
  renderWithCtx(
    <DashboardActivity toplevel={makeToplevelFixture()} Frame={Frame} />,
  );

  expect(
    screen.getByRole("heading", { name: "24h Activity Report" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Recording activity history not available yet"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("No 24h recording history available"),
  ).toBeInTheDocument();
  expect(screen.queryByTestId("activity-history-bars")).not.toBeInTheDocument();
});

test("shows active recording status when recent frames are available", () => {
  const toplevel = makeToplevelFixture();
  const stream = toplevel.cameras[0].streams.main!;
  stream.numRecentRecordings = 1;
  stream.numRecentFrames = 19;
  stream.recentFrameBytes = 1_379_346;
  stream.totalSampleFileBytes = 45_479_186;
  stream.fsBytes = 45_481_984;

  renderWithCtx(<DashboardActivity toplevel={toplevel} Frame={Frame} />);

  const frontDoorCard = screen.getByTestId("feed-card-front-door");
  expect(
    within(frontDoorCard).getByText("Recording active"),
  ).toBeInTheDocument();
  expect(
    within(frontDoorCard).getByText("19 recent frames"),
  ).toBeInTheDocument();
  expect(
    within(frontDoorCard).queryByText("No recent recording"),
  ).not.toBeInTheDocument();
});

test("shows 24h activity report from real day data", () => {
  const toplevel = makeToplevelFixture();
  const stream = toplevel.cameras[0].streams.main!;
  stream.days = {
    "2026-05-28": {
      startTime90k: 160_193_376_000_000,
      endTime90k: 160_201_152_000_000,
      totalDuration90k: 8_095_042,
    },
  };

  renderWithCtx(<DashboardActivity toplevel={toplevel} Frame={Frame} />);

  expect(
    screen.getByRole("heading", { name: "24h Activity Report" }),
  ).toBeInTheDocument();
  expect(screen.getByText("1 day with recording activity")).toBeInTheDocument();
  expect(screen.getByText("2026-05-28")).toBeInTheDocument();
  expect(screen.getByTestId("activity-history-bars")).toBeInTheDocument();
  expect(
    screen.queryByText("Recording activity history not available yet"),
  ).not.toBeInTheDocument();
});

test("formats byte counts consistently through terabytes", () => {
  expect(formatBytes(999)).toBe("999 bytes");
  expect(formatBytes(3300)).toBe("3.3 KB");
  expect(formatBytes(2000)).toBe("2.0 KB");
  expect(formatBytes(1_500_000_000_000)).toBe("1.5 TB");
});
