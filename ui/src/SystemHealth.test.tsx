// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import { screen } from "@testing-library/react";
import { expect, test } from "vitest";
import SystemHealthActivity from "./SystemHealth";
import { FrameProps } from "./App";
import { renderWithCtx } from "./testutil";
import type * as api from "./api";

const Frame = ({ children }: FrameProps) => <>{children}</>;

const TOPLEVEL: api.ToplevelResponse = {
  timeZoneName: "Asia/Ho_Chi_Minh",
  cameras: [
    {
      uuid: "front-door",
      shortName: "Front Door",
      description: "Entrance",
      streams: {
        main: {
          id: 1,
          retainBytes: 2000,
          minStartTime90k: 0,
          maxEndTime90k: 180_000,
          totalDuration90k: 180_000,
          totalSampleFileBytes: 1500,
          fsBytes: 2500,
          days: {},
          record: true,
        } as any,
      },
    },
  ],
  streams: new Map(),
  permissions: {
    adminUsers: true,
    readCameraConfigs: true,
    updateSignals: true,
    viewVideo: true,
  },
  user: { name: "operator", id: 7, session: { csrf: "csrf-token" } },
};

test("shows system health and operator capability summary", () => {
  renderWithCtx(<SystemHealthActivity toplevel={TOPLEVEL} Frame={Frame} />);

  expect(screen.getByRole("heading", { name: "System Health" })).toBeInTheDocument();
  expect(screen.getByText("Asia/Ho_Chi_Minh")).toBeInTheDocument();
  expect(screen.getByText("operator")).toBeInTheDocument();
  expect(screen.getByText("1 camera configured")).toBeInTheDocument();
  expect(screen.getByText("1 recording stream active")).toBeInTheDocument();
  expect(screen.getByText("2 seconds retained")).toBeInTheDocument();
  expect(screen.getByText("2.5 KB on disk")).toBeInTheDocument();
  expect(screen.getByText("Full administration enabled")).toBeInTheDocument();
});
