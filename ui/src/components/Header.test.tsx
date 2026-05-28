// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import Header from "./Header";
import { renderWithCtx } from "../testutil";
import type * as api from "../api";

const TOPLEVEL: api.ToplevelResponse = {
  timeZoneName: "UTC",
  cameras: [],
  streams: new Map(),
  permissions: { adminUsers: true, updateSignals: true },
  serverVersion: "0.0.0",
  user: undefined,
};

const renderHeader = () =>
  renderWithCtx(
    <Header
      loginState="logged-in"
      logout={() => {}}
      setChangePasswordOpen={() => {}}
      activityMenuPart={undefined}
      setLoginState={() => {}}
      toplevel={TOPLEVEL}
    />,
  );

test("drawer links to Archive playback page", async () => {
  const user = userEvent.setup();
  renderHeader();

  await user.click(screen.getByRole("button", { name: "menu" }));
  const archiveLink = await screen.findByRole("link", { name: /Archive/ });
  expect(archiveLink).toHaveAttribute("href", "/archive");
});

test("drawer links to management pages", async () => {
  const user = userEvent.setup();
  renderHeader();

  await user.click(screen.getByRole("button", { name: "menu" }));

  expect(
    await screen.findByRole("link", { name: "Dashboard" }),
  ).toHaveAttribute("href", "/");
  expect(
    screen.queryByRole("link", { name: /Live view/i }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "System Health" })).toHaveAttribute(
    "href",
    "/system",
  );
  expect(screen.getByRole("link", { name: "Signal Controls" })).toHaveAttribute(
    "href",
    "/signals",
  );
  expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute(
    "href",
    "/users",
  );
  expect(screen.getByRole("link", { name: "Cameras" })).toHaveAttribute(
    "href",
    "/cameras",
  );
});
