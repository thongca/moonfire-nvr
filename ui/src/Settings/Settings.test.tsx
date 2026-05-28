// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import SettingsActivity from "./index";
import { renderWithCtx } from "../testutil";
import React from "react";

const server = setupServer(
  http.get("/api/cameras", () => HttpResponse.json({ cameras: [] })),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const Frame = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const baseProps = {
  Frame: Frame as any,
  csrf: "token",
  serverVersion: "0.0.0",
};

test("renders settings title and sub-section nav", () => {
  renderWithCtx(<SettingsActivity {...baseProps} />);

  expect(screen.getByText("System Settings")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Camera Config" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Storage Management" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "User Permissions" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Network" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "System Updates" }),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId("settings-content")).getByText(
      "Storage Management",
    ),
  ).toBeInTheDocument();
});

test("clicking a nav item switches the active section", async () => {
  renderWithCtx(<SettingsActivity {...baseProps} />);

  await userEvent.click(screen.getByRole("button", { name: "Network" }));

  expect(
    within(screen.getByTestId("settings-content")).getByText("Network"),
  ).toBeInTheDocument();
});
