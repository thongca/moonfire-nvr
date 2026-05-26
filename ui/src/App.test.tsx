// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { screen } from "@testing-library/react";
import App from "./App";
import { renderWithCtx } from "./testutil";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterAll, afterEach, expect, test } from "vitest";
import { shellTokens, theme } from "./theme";

const server = setupServer(
  http.get("/api/", () => {
    return HttpResponse.text("server error", { status: 503 });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("instantiate", async () => {
  renderWithCtx(<App />);
  expect(screen.getByText(/Moonfire NVR/)).toBeInTheDocument();
  // Wait for the /api/ fetch to complete and error state to render,
  // so cleanup's abort() doesn't race with msw's response.
  await screen.findByText(/Error querying server/);
});

test("dashboard renders at root", async () => {
  // Override server to return a minimal successful toplevel response so routes render.
  server.use(
    http.get("/api/", () =>
      HttpResponse.json({
        timeZoneName: "UTC",
        serverVersion: "0.0.0",
        cameras: [],
        permissions: {},
        signals: [],
        signalTypes: [],
      }),
    ),
  );
  renderWithCtx(<App />);
  // DashboardActivity renders "System Overview" at the root route.
  expect(await screen.findByText("System Overview")).toBeInTheDocument();
});

test("shared dark theme uses stitch token values", () => {
  expect(shellTokens.background.base).toBe("#131313");
  expect(shellTokens.surface.panel).toBe("#1c1b1b");
  expect(shellTokens.surface.raised).toBe("#201f1f");
  expect(shellTokens.surface.table).toBe("#2a2a2a");
  expect(shellTokens.surface.overlay).toBe("#353534");
  expect(shellTokens.primary.fireOrange).toBe("#ff5722");

  expect(theme.palette.background.default).toBe(shellTokens.background.base);
  expect(theme.palette.primary.main).toBe(shellTokens.primary.fireOrange);
  expect(theme.palette.header).toBe(shellTokens.surface.raised);
});
