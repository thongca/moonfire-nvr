// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import SettingsActivity from "./index";
import { renderWithCtx } from "../testutil";
import React from "react";

const Frame = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const baseProps = {
  Frame: Frame as any,
  csrf: "token",
  serverVersion: "0.0.0",
};

test("renders settings title and sub-section nav", () => {
  renderWithCtx(<SettingsActivity {...baseProps} />);

  expect(screen.getByText("System Settings")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Camera Config" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Storage Management" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "User Permissions" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Network" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "System Updates" })).toBeInTheDocument();
});

test("clicking a nav item switches the active section", async () => {
  renderWithCtx(<SettingsActivity {...baseProps} />);

  await userEvent.click(screen.getByRole("button", { name: "Network" }));

  expect(within(screen.getByTestId("settings-content")).getByText("Network")).toBeInTheDocument();
});
