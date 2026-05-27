// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import AddEditDialog from "./AddEditDialog";
import { renderWithCtx } from "../testutil";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderAddDialog = () =>
  renderWithCtx(
    <AddEditDialog
      open={true}
      camera={null}
      csrf="csrf-token"
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );

test("renders sectioned command dialog stream summaries", () => {
  renderAddDialog();

  expect(screen.getByText("Configure identity, connection, and stream routing"))
    .toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Camera Identity" }))
    .toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Connection" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Stream Routing" }))
    .toBeInTheDocument();

  for (const streamName of ["MAIN", "SUB", "EXT"]) {
    const card = screen.getByTestId(`stream-summary-${streamName.toLowerCase()}`);
    expect(within(card).getByText(streamName)).toBeInTheDocument();
    expect(within(card).getByText("Off")).toBeInTheDocument();
    expect(within(card).getByText("No RTSP URL")).toBeInTheDocument();
    expect(within(card).getByText("Auto")).toBeInTheDocument();
  }
});

test("creates camera then saves configured main stream", async () => {
  const user = userEvent.setup();
  let createBody: any = null;
  let streamBody: any = null;

  server.use(
    http.post("/api/cameras", async ({ request }) => {
      createBody = await request.json();
      return HttpResponse.json({ cameraId: 42 });
    }),
    http.put("/api/cameras/42/streams/main", async ({ request }) => {
      streamBody = await request.json();
      return new HttpResponse(null, { status: 204 });
    }),
    http.put("/api/cameras/42/streams/sub", () =>
      new HttpResponse(null, { status: 204 }),
    ),
    http.put("/api/cameras/42/streams/ext", () =>
      new HttpResponse(null, { status: 204 }),
    ),
  );

  renderWithCtx(
    <AddEditDialog
      open={true}
      camera={null}
      csrf="csrf-token"
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );

  await user.type(screen.getByLabelText(/Short Name/), "Front Door");
  await user.type(screen.getByLabelText(/Description/), "Entrance camera");
  await user.click(screen.getAllByRole("combobox")[0]);
  await user.click(screen.getByRole("option", { name: "Record" }));
  await user.type(screen.getAllByLabelText(/RTSP URL/)[0], "rtsp://camera/main");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  await waitFor(() => expect(streamBody).not.toBeNull());
  expect(createBody).toMatchObject({
    csrf: "csrf-token",
    shortName: "Front Door",
    description: "Entrance camera",
  });
  expect(streamBody).toMatchObject({
    csrf: "csrf-token",
    mode: "record",
    rtspUrl: "rtsp://camera/main",
  });
});
