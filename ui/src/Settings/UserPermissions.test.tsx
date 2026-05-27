// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import UserPermissions from "./UserPermissions";
import { renderWithCtx } from "../testutil";

vi.mock("../api", () => ({
  users: vi.fn(),
}));

import * as api from "../api";

afterEach(() => {
  vi.clearAllMocks();
});

test("renders user list with role badges", async () => {
  vi.mocked(api.users).mockResolvedValue({
    status: "success",
    response: {
      users: [
        {
          id: 1,
          user: {
            username: "alice",
            permissions: { adminUsers: true },
          },
        },
        {
          id: 2,
          user: {
            username: "bob",
            permissions: {},
          },
        },
      ],
    },
  } as api.FetchResult<api.UsersResponse>);

  renderWithCtx(<UserPermissions />);

  expect(await screen.findByText("alice")).toBeInTheDocument();
  expect(screen.getByText("Admin")).toBeInTheDocument();
  expect(screen.getByText("bob")).toBeInTheDocument();
  expect(screen.getByText("Viewer")).toBeInTheDocument();
});
