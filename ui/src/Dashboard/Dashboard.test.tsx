// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { screen } from "@testing-library/react";
import { expect, test } from "vitest";
import DashboardActivity from "./index";
import { renderWithCtx } from "../testutil";
import * as api from "../api";

const Frame = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const fakeToplevel: api.ToplevelResponse = {
  timeZoneName: "America/Los_Angeles",
  cameras: [],
  serverVersion: "test",
  streams: new Map(),
  permissions: {},
  user: undefined,
};

test("renders system overview heading", () => {
  renderWithCtx(<DashboardActivity Frame={Frame as any} toplevel={fakeToplevel} />);
  expect(screen.getByText("System Overview")).toBeInTheDocument();
});

test("renders all four stat card labels", () => {
  renderWithCtx(<DashboardActivity Frame={Frame as any} toplevel={fakeToplevel} />);
  expect(screen.getByText("CAMERAS")).toBeInTheDocument();
  expect(screen.getByText("COMPUTE LOAD")).toBeInTheDocument();
  expect(screen.getByText("STORAGE ARRAY")).toBeInTheDocument();
  expect(screen.getByText("UNRESOLVED ALERTS")).toBeInTheDocument();
});
