// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import { screen } from "@testing-library/react";
import { expect, test } from "vitest";
import SignalControlsActivity from "./SignalControls";
import { FrameProps } from "./App";
import { renderWithCtx } from "./testutil";
import type * as api from "./api";

const Frame = ({ children }: FrameProps) => <>{children}</>;

const TOPLEVEL: api.ToplevelResponse = {
  timeZoneName: "UTC",
  serverVersion: "0.0.0",
  cameras: [
    {
      uuid: "front-door",
      shortName: "Front Door",
      description: "Entrance",
      streams: {
        main: {
          id: 1,
          retainBytes: 1000,
          minStartTime90k: 0,
          maxEndTime90k: 90_000,
          totalDuration90k: 90_000,
          totalSampleFileBytes: 500,
          fsBytes: 750,
          days: {},
          record: true,
        } as any,
        sub: {
          id: 2,
          retainBytes: 1000,
          minStartTime90k: 0,
          maxEndTime90k: 90_000,
          totalDuration90k: 90_000,
          totalSampleFileBytes: 250,
          fsBytes: 350,
          days: {},
          record: false,
        } as any,
      },
    },
  ],
  streams: new Map(),
  permissions: { updateSignals: true },
  user: undefined,
};

test("lists stream recording controls for signal operators", () => {
  renderWithCtx(<SignalControlsActivity toplevel={TOPLEVEL} Frame={Frame} />);

  expect(screen.getByRole("heading", { name: "Signal Controls" })).toBeInTheDocument();
  expect(screen.getByText("Front Door")).toBeInTheDocument();
  expect(screen.getByText("MAIN recording")).toBeInTheDocument();
  expect(screen.getByText("SUB disabled")).toBeInTheDocument();
  expect(screen.getByText("Signal updates enabled")).toBeInTheDocument();
});
