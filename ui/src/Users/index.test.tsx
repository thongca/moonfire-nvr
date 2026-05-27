// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import UsersActivity from ".";
import { FrameProps } from "../App";
import { renderWithCtx } from "../testutil";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const Frame = ({ children }: FrameProps) => <>{children}</>;

test("shows granted permissions for each user", async () => {
  server.use(
    http.get("/api/users/", () =>
      HttpResponse.json({
        users: [
          {
            id: 1,
            user: {
              username: "admin",
              permissions: {
                adminUsers: true,
                readCameraConfigs: true,
                updateSignals: true,
                viewVideo: true,
              },
            },
          },
          {
            id: 2,
            user: {
              username: "viewer",
              permissions: {
                viewVideo: true,
              },
            },
          },
        ],
      }),
    ),
  );

  renderWithCtx(<UsersActivity Frame={Frame} csrf="csrf-token" />);

  expect(await screen.findByText("Admin users")).toBeInTheDocument();
  expect(screen.getByText("Read camera configs")).toBeInTheDocument();
  expect(screen.getByText("Update signals")).toBeInTheDocument();
  expect(screen.getAllByText("View video")).toHaveLength(2);
});
