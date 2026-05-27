// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import { screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import DashboardActivity from "./Dashboard";
import { formatBytes } from "./format";
import { FrameProps } from "./App";
import { renderWithCtx } from "./testutil";
import type * as api from "./api";
import type { Camera, Stream } from "./types";

const Frame = ({ children }: FrameProps) => <>{children}</>;

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

test("shows Dashboard Command Center overview telemetry", () => {
  renderWithCtx(<DashboardActivity toplevel={makeToplevelFixture()} Frame={Frame} />);

  expect(screen.getByRole("heading", { name: "System Overview" })).toBeInTheDocument();
  expect(screen.getByText("Infrastructure monitoring and recording telemetry")).toBeInTheDocument();
  expect(screen.getByText(/Live Sync/i)).toBeInTheDocument();

  const camerasMetric = screen.getByText("Cameras").closest("article");
  expect(camerasMetric).not.toBeNull();
  expect(within(camerasMetric!).getByText("2")).toBeInTheDocument();

  const recordingLoadMetric = screen.getByText("Recording Load").closest("article");
  expect(recordingLoadMetric).not.toBeNull();
  expect(within(recordingLoadMetric!).getByText("50%")).toBeInTheDocument();
  expect(within(recordingLoadMetric!).getByText("1 / 2 recording")).toBeInTheDocument();

  const storageUsedMetric = screen.getByText("Storage Used").closest("article");
  expect(storageUsedMetric).not.toBeNull();
  expect(within(storageUsedMetric!).getByText("3.3 KB")).toBeInTheDocument();
  expect(within(storageUsedMetric!).getByText("2.0 KB recorded samples")).toBeInTheDocument();

  const activityStatusMetric = screen.getByText("Activity Status").closest("article");
  expect(activityStatusMetric).not.toBeNull();
  expect(within(activityStatusMetric!).getByText("No active signals")).toBeInTheDocument();
  expect(within(activityStatusMetric!).getByText("Signal telemetry unavailable"))
    .toBeInTheDocument();
  expect(within(activityStatusMetric!).queryByText("1 idle")).not.toBeInTheDocument();
  expect(within(activityStatusMetric!).queryByText("1 camera without active recording"))
    .not.toBeInTheDocument();
});

test("shows priority feed cards", () => {
  renderWithCtx(<DashboardActivity toplevel={makeToplevelFixture()} Frame={Frame} />);

  expect(screen.getByRole("heading", { name: "Priority Feeds" })).toBeInTheDocument();

  const frontDoorCard = screen.getByTestId("feed-card-front-door");
  expect(within(frontDoorCard).getByText("Front Door")).toBeInTheDocument();
  expect(within(frontDoorCard).getByText("No recent recording")).toBeInTheDocument();
  expect(within(frontDoorCard).getByText("1 recording stream")).toBeInTheDocument();

  const garageCard = screen.getByTestId("feed-card-garage");
  expect(within(garageCard).getByRole("heading", { name: "Garage" })).toBeInTheDocument();
  expect(within(garageCard).getByText("No recent recording")).toBeInTheDocument();
  expect(within(garageCard).getByText("0 recording streams")).toBeInTheDocument();
});

test("shows quick management stream status", () => {
  renderWithCtx(<DashboardActivity toplevel={makeToplevelFixture()} Frame={Frame} />);

  expect(screen.getByRole("heading", { name: "Quick Management" })).toBeInTheDocument();

  const quickManagement = screen.getByTestId("quick-management");
  expect(within(quickManagement).getByText("Front Door")).toBeInTheDocument();
  expect(within(quickManagement).getByText("1 active / 2 streams")).toBeInTheDocument();
  expect(within(quickManagement).getByText("Garage")).toBeInTheDocument();
  expect(within(quickManagement).getByText("0 active / 0 streams")).toBeInTheDocument();

  const managementLinks = within(quickManagement).getAllByRole("link", {
    name: "Manage Camera",
  });
  expect(managementLinks).toHaveLength(2);
  expect(managementLinks[0]).toHaveAttribute("href", "/cameras");
  expect(managementLinks[1]).toHaveAttribute("href", "/cameras");
});

test("shows activity report placeholder", () => {
  renderWithCtx(<DashboardActivity toplevel={makeToplevelFixture()} Frame={Frame} />);

  expect(screen.getByRole("heading", { name: "24h Activity Report" })).toBeInTheDocument();
  expect(screen.getByText("Recording activity history not available yet")).toBeInTheDocument();
  expect(screen.getByText("No 24h recording history available")).toBeInTheDocument();
  expect(screen.queryByTestId("activity-history-bars")).not.toBeInTheDocument();
});

test("formats byte counts consistently through terabytes", () => {
  expect(formatBytes(999)).toBe("999 bytes");
  expect(formatBytes(3300)).toBe("3.3 KB");
  expect(formatBytes(2000)).toBe("2.0 KB");
  expect(formatBytes(1_500_000_000_000)).toBe("1.5 TB");
});
