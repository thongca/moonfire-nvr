// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import React from "react";
import { beforeAll, afterEach, afterAll, test, expect } from "vitest";

import * as api from "../api";
import { Camera } from "../types";
import { renderWithCtx } from "../testutil";
import ArchiveActivity from "./index";

// Suppress jsdom HTMLMediaElement not implemented errors
Object.defineProperty(HTMLMediaElement.prototype, "load", {
  configurable: true,
  value: () => {},
});
Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  value: () => Promise.resolve(undefined),
});

const NOW_MS = 1_748_880_000_000;
const NOW_90K = Math.floor((NOW_MS / 1000) * 90000);

const CAMERA_A: Camera = {
  uuid: "aaaa0000-0000-0000-0000-000000000001",
  shortName: "Front Door",
  description: "",
  streams: {
    main: {
      camera: null as any,
      id: 1,
      streamType: "main",
      retainBytes: 1_000_000,
      minStartTime90k: NOW_90K - 2 * 60 * 60 * 90000,
      maxEndTime90k: NOW_90K,
      totalDuration90k: 2 * 60 * 60 * 90000,
      totalSampleFileBytes: 50_000_000,
      fsBytes: 50_000_000,
      days: {},
      record: true,
    },
  },
};

const CAMERA_B: Camera = {
  uuid: "bbbb0000-0000-0000-0000-000000000002",
  shortName: "Back Gate",
  description: "",
  streams: {
    main: {
      camera: null as any,
      id: 2,
      streamType: "main",
      retainBytes: 1_000_000,
      minStartTime90k: 0,
      maxEndTime90k: NOW_90K,
      totalDuration90k: 0,
      totalSampleFileBytes: 0,
      fsBytes: 0,
      days: {},
      record: true,
    },
  },
};

const VSE_1 = { width: 1920, height: 1080, aspectWidth: 16, aspectHeight: 9 };

const REC_1: api.Recording = {
  startId: 101,
  endId: 101,
  openId: 1,
  runStartId: 100,
  startTime90k: NOW_90K - 2 * 60 * 60 * 90000,
  endTime90k: NOW_90K - 60 * 60 * 90000,
  videoSampleEntryId: 1,
  videoSamples: 108000,
  sampleFileBytes: 30_000_000,
};

const REC_2: api.Recording = {
  startId: 102,
  endId: 102,
  openId: 1,
  runStartId: 102,
  startTime90k: NOW_90K - 60 * 60 * 90000,
  endTime90k: NOW_90K,
  videoSampleEntryId: 1,
  videoSamples: 108000,
  sampleFileBytes: 20_000_000,
};

const FAKE_TOPLEVEL: api.ToplevelResponse = {
  timeZoneName: "UTC",
  cameras: [CAMERA_A, CAMERA_B],
  streams: new Map(),
  permissions: {},
  user: undefined,
};

const FAKE_FRAME = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
);

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockRecordingsA() {
  server.use(
    http.get(
      `/api/cameras/${CAMERA_A.uuid}/main/recordings`,
      () =>
        HttpResponse.json({
          recordings: [REC_2, REC_1],
          videoSampleEntries: { 1: VSE_1 },
        }),
    ),
  );
}

test("renders camera chips from toplevel", async () => {
  mockRecordingsA();
  renderWithCtx(
    <ArchiveActivity
      Frame={FAKE_FRAME}
      toplevel={FAKE_TOPLEVEL}
      timeZoneName="UTC"
    />,
  );
  expect(await screen.findByText("CAM 01")).toBeInTheDocument();
  expect(screen.getByText("CAM 02")).toBeInTheDocument();
});

test("fetches recordings on mount and shows count", async () => {
  mockRecordingsA();
  renderWithCtx(
    <ArchiveActivity
      Frame={FAKE_FRAME}
      toplevel={{ ...FAKE_TOPLEVEL, cameras: [CAMERA_A] }}
      timeZoneName="UTC"
    />,
  );
  expect(await screen.findByText("2 đoạn phim")).toBeInTheDocument();
});

test("selecting a camera chip refetches recordings", async () => {
  const user = userEvent.setup();
  let camBCalled = false;
  server.use(
    http.get(
      `/api/cameras/${CAMERA_A.uuid}/main/recordings`,
      () =>
        HttpResponse.json({
          recordings: [REC_1],
          videoSampleEntries: { 1: VSE_1 },
        }),
    ),
    http.get(`/api/cameras/${CAMERA_B.uuid}/main/recordings`, () => {
      camBCalled = true;
      return HttpResponse.json({ recordings: [], videoSampleEntries: {} });
    }),
  );
  renderWithCtx(
    <ArchiveActivity
      Frame={FAKE_FRAME}
      toplevel={FAKE_TOPLEVEL}
      timeZoneName="UTC"
    />,
  );
  await screen.findByText("CAM 01");
  await user.click(screen.getByText("CAM 02"));
  await waitFor(() => expect(camBCalled).toBe(true));
});

test("clicking a recording row sets video src", async () => {
  const user = userEvent.setup();
  mockRecordingsA();
  renderWithCtx(
    <ArchiveActivity
      Frame={FAKE_FRAME}
      toplevel={{ ...FAKE_TOPLEVEL, cameras: [CAMERA_A] }}
      timeZoneName="UTC"
    />,
  );
  await screen.findByText("2 đoạn phim");
  const rows = screen.getAllByText("Bản ghi hệ thống");
  await user.click(rows[0]);
  const video = document.querySelector("video") as HTMLVideoElement;
  expect(video).not.toBeNull();
  expect(video.src).toContain("/api/cameras/");
  expect(video.src).toContain("view.mp4");
});

test("export button disabled when no active recording", async () => {
  mockRecordingsA();
  renderWithCtx(
    <ArchiveActivity
      Frame={FAKE_FRAME}
      toplevel={{ ...FAKE_TOPLEVEL, cameras: [CAMERA_A] }}
      timeZoneName="UTC"
    />,
  );
  await screen.findByText("2 đoạn phim");
  expect(
    screen.getByRole("button", { name: "Thiết lập xuất dữ liệu" }),
  ).toBeDisabled();
});

test("export dialog opens after clicking export CTA", async () => {
  const user = userEvent.setup();
  mockRecordingsA();
  renderWithCtx(
    <ArchiveActivity
      Frame={FAKE_FRAME}
      toplevel={{ ...FAKE_TOPLEVEL, cameras: [CAMERA_A] }}
      timeZoneName="UTC"
    />,
  );
  await screen.findByText("2 đoạn phim");
  // Select a recording first
  await user.click(screen.getAllByText("Bản ghi hệ thống")[0]);
  // Export button now enabled
  await user.click(screen.getByRole("button", { name: "Thiết lập xuất dữ liệu" }));
  expect(await screen.findByText("Xuất đoạn phim")).toBeInTheDocument();
  expect(screen.getAllByText(/Front Door/).length).toBeGreaterThan(0);
});
