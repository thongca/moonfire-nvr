// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

test("operator can navigate dashboard and create a camera with recording stream", async () => {
  const user = userEvent.setup();
  let createdCamera: any = null;
  let createdStream: any = null;

  server.use(
    http.get("/api/", () =>
      HttpResponse.json({
        timeZoneName: "UTC",
        serverVersion: "0.0.0",
        cameras: [],
        permissions: {
          adminUsers: true,
          readCameraConfigs: true,
          updateSignals: true,
          viewVideo: true,
        },
        user: { name: "operator", id: 1, session: { csrf: "csrf-token" } },
      }),
    ),
    http.get("/api/cameras", () => HttpResponse.json({ cameras: [] })),
    http.post("/api/cameras", async ({ request }) => {
      createdCamera = await request.json();
      return HttpResponse.json({ cameraId: 99 });
    }),
    http.put("/api/cameras/99/streams/main", async ({ request }) => {
      createdStream = await request.json();
      return new HttpResponse(null, { status: 204 });
    }),
    http.put("/api/cameras/99/streams/sub", () => new HttpResponse(null, { status: 204 })),
    http.put("/api/cameras/99/streams/ext", () => new HttpResponse(null, { status: 204 })),
  );

  renderWithCtx(<App />, { initialEntries: ["/cameras"] });

  await user.click(await screen.findByRole("button", { name: "Add Camera" }));
  await user.type(screen.getByLabelText(/Short Name/), "Front Door");
  await user.type(screen.getByLabelText(/Description/), "Entrance camera");
  await user.click(screen.getAllByRole("combobox")[0]);
  await user.click(screen.getByRole("option", { name: "Record" }));
  await user.type(screen.getAllByLabelText(/RTSP URL/)[0], "rtsp://camera/main");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  await screen.findByRole("heading", { name: "Camera Management" });
  expect(createdCamera).toMatchObject({
    csrf: "csrf-token",
    shortName: "Front Door",
    description: "Entrance camera",
  });
  expect(createdStream).toMatchObject({
    csrf: "csrf-token",
    mode: "record",
    rtspUrl: "rtsp://camera/main",
  });
});

test("dashboard shell renders at root", async () => {
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
  renderWithCtx(<App />, { initialEntries: ["/"] });
  expect(await screen.findByRole("link", { name: "Dashboard" })).toHaveAttribute(
    "href",
    "/",
  );
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
