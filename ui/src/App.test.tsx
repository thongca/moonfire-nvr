// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { renderWithCtx } from "./testutil";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterAll, afterEach, expect, test } from "vitest";

const server = setupServer(
  http.get("/api/", () => {
    return HttpResponse.text("server error", { status: 503 });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("operator can navigate dashboard and create a camera with recording stream", async () => {
  const user = userEvent.setup();
  let createdCamera: any = null;
  let createdStream: any = null;

  server.use(
    http.get("/api/", () =>
      HttpResponse.json({
        timeZoneName: "UTC",
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

  renderWithCtx(<App />);

  await user.click(await screen.findByRole("link", { name: "Manage Cameras" }));
  await user.click(await screen.findByRole("button", { name: "+ Add Camera" }));
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
