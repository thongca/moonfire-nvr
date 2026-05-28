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

function mockSampleFileDirs(
  sampleFileDirs = [{ id: 7, path: "/var/lib/moonfire-nvr/sample" }],
) {
  server.use(
    http.get("/api/sample-file-dirs", () =>
      HttpResponse.json({ sampleFileDirs }),
    ),
  );
}

test("renders sectioned command dialog stream summaries", () => {
  mockSampleFileDirs();
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

test("switches stream form when a summary card is selected", async () => {
  const user = userEvent.setup();
  mockSampleFileDirs();
  renderAddDialog();

  await user.click(screen.getByTestId("stream-summary-sub"));

  expect(screen.getByRole("tab", { name: "SUB", selected: true }))
    .toBeInTheDocument();
  await user.type(screen.getByLabelText("RTSP URL"), "rtsp://camera/sub");
  expect(within(screen.getByTestId("stream-summary-sub")).getByText("RTSP configured"))
    .toBeInTheDocument();
  expect(within(screen.getByTestId("stream-summary-main")).getByText("No RTSP URL"))
    .toBeInTheDocument();
});

test("updates the active stream summary from form edits", async () => {
  const user = userEvent.setup();
  mockSampleFileDirs();
  renderAddDialog();

  const mainSummary = screen.getByTestId("stream-summary-main");
  expect(within(mainSummary).getByText("Off")).toBeInTheDocument();
  expect(within(mainSummary).getByText("Auto")).toBeInTheDocument();

  await user.click(screen.getByLabelText("Mode"));
  await user.click(screen.getByRole("option", { name: "Record" }));
  expect(within(mainSummary).getByText("Record")).toBeInTheDocument();

  await user.click(screen.getByLabelText("Transport"));
  await user.click(screen.getByRole("option", { name: "TCP" }));
  expect(within(mainSummary).getByText("TCP")).toBeInTheDocument();
});

test("shows storage directory options and warns when recording has none", async () => {
  const user = userEvent.setup();
  mockSampleFileDirs([
    { id: 7, path: "/var/lib/moonfire-nvr/sample" },
    { id: 8, path: "/media/nvr/sample" },
  ]);
  renderAddDialog();

  await screen.findByText("Storage Directory");
  await user.click(screen.getByLabelText("Mode"));
  await user.click(screen.getByRole("option", { name: "Record" }));

  expect(
    screen.getByText(
      "Recording requires a storage directory. Create or select one before saving.",
    ),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId("stream-summary-main")).getByText(
      "Storage dir missing",
    ),
  ).toBeInTheDocument();

  await user.click(screen.getByLabelText("Storage Directory"));
  expect(
    screen.getByRole("option", {
      name: "Dir 7 — /var/lib/moonfire-nvr/sample",
    }),
  ).toBeInTheDocument();
  await user.click(
    screen.getByRole("option", { name: "Dir 8 — /media/nvr/sample" }),
  );

  expect(
    screen.queryByText(
      "Recording requires a storage directory. Create or select one before saving.",
    ),
  ).not.toBeInTheDocument();
  expect(within(screen.getByTestId("stream-summary-main")).getByText("Dir 8"))
    .toBeInTheDocument();
});

test("creates a storage directory and selects it for the active stream", async () => {
  const user = userEvent.setup();
  let createBody: any = null;
  mockSampleFileDirs([]);
  server.use(
    http.post("/api/sample-file-dirs", async ({ request }) => {
      createBody = await request.json();
      return HttpResponse.json({ id: 9 });
    }),
    http.get("/api/sample-file-dirs", () =>
      HttpResponse.json({
        sampleFileDirs: [{ id: 9, path: "/tmp/moonfire-sample" }],
      }),
    ),
  );

  renderAddDialog();

  await user.click(await screen.findByRole("button", { name: "Create directory" }));
  await user.type(screen.getByLabelText("Directory path"), "/tmp/moonfire-sample");
  await user.click(screen.getByRole("button", { name: "Create" }));

  await screen.findByText("Storage directory Dir 9 created");
  expect(createBody).toMatchObject({
    csrf: "csrf-token",
    path: "/tmp/moonfire-sample",
  });
  expect(screen.getByLabelText("Storage Directory")).toHaveTextContent("Dir 9");
  expect(within(screen.getByTestId("stream-summary-main")).getByText("Dir 9"))
    .toBeInTheDocument();
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

  mockSampleFileDirs();

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
  await user.click(screen.getByLabelText("Storage Directory"));
  await user.click(
    screen.getByRole("option", { name: "Dir 7 — /var/lib/moonfire-nvr/sample" }),
  );
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
    sampleFileDirId: 7,
  });
});
