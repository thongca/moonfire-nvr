// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import CamerasActivity from ".";
import { renderWithCtx } from "../testutil";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const Frame = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

test("shows whether each camera has stored credentials", async () => {
  server.use(
    http.get("/api/cameras", () =>
      HttpResponse.json({
        cameras: [
          {
            id: 1,
            uuid: "front-door",
            shortName: "Front Door",
            description: "Entrance camera",
            hasCredentials: true,
            streams: [],
          },
          {
            id: 2,
            uuid: "garage",
            shortName: "Garage",
            description: "",
            hasCredentials: false,
            streams: [],
          },
        ],
      }),
    ),
  );

  renderWithCtx(<CamerasActivity Frame={Frame} csrf="csrf-token" />);

  expect(await screen.findByText("Credentials saved")).toBeInTheDocument();
  expect(screen.getByText("No credentials")).toBeInTheDocument();
});
