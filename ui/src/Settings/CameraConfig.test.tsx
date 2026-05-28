// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import CameraConfig from "./CameraConfig";
import { renderWithCtx } from "../testutil";

vi.mock("../api", () => ({
  getCamerasAdmin: vi.fn(),
  deleteCamera: vi.fn(),
}));

vi.mock("../Cameras/viewModel", async () => {
  const actual = await vi.importActual<typeof import("../Cameras/viewModel")>(
    "../Cameras/viewModel",
  );
  return {
    ...actual,
    cameraStatus: vi.fn(() => {
      throw new Error("CameraConfig should use cameraRecordingStatus");
    }),
  };
});

import * as api from "../api";

afterEach(() => {
  vi.clearAllMocks();
});

test("renders camera config heading and add button", async () => {
  vi.mocked(api.getCamerasAdmin).mockResolvedValue({
    status: "success",
    response: { cameras: [] },
  } as api.FetchResult<api.GetCamerasAdminResponse>);

  renderWithCtx(<CameraConfig csrf="token" />);

  expect(await screen.findByText("Camera Configuration")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "+ Add Camera" })).toBeInTheDocument();
  expect(screen.getByText("No cameras configured.")).toBeInTheDocument();
});

test("renders camera rows with name and IP", async () => {
  vi.mocked(api.getCamerasAdmin).mockResolvedValue({
    status: "success",
    response: {
      cameras: [
        {
          id: 1,
          uuid: "abc-123",
          shortName: "Lobby",
          description: "Main entrance",
          onvifBaseUrl: "http://192.168.1.50/onvif/device_service",
          hasCredentials: false,
          streams: [],
        },
      ],
    },
  } as api.FetchResult<api.GetCamerasAdminResponse>);

  renderWithCtx(<CameraConfig csrf="token" />);

  expect(await screen.findByText("Lobby")).toBeInTheDocument();
  expect(screen.getByText("192.168.1.50")).toBeInTheDocument();
});

test("renders recording status and retention summary", async () => {
  vi.mocked(api.getCamerasAdmin).mockResolvedValue({
    status: "success",
    response: {
      cameras: [
        {
          id: 1,
          uuid: "abc-123",
          shortName: "Lobby",
          description: "Main entrance",
          onvifBaseUrl: "http://192.168.1.50/onvif/device_service",
          hasCredentials: false,
          streams: [
            {
              id: 10,
              type: "main",
              mode: "record",
              rtspUrl: "rtsp://192.168.1.50/main",
              rtspTransport: "tcp",
              sampleFileDirId: 7,
              retainBytes: 50_000_000_000,
              flushIfSec: 5,
            },
          ],
        },
      ],
    },
  } as api.FetchResult<api.GetCamerasAdminResponse>);

  renderWithCtx(<CameraConfig csrf="token" />);

  expect(await screen.findByText("Waiting for frames")).toBeInTheDocument();
  expect(screen.getByText("main: configured, no frames yet")).toBeInTheDocument();
  expect(screen.getByText("50 GB limit")).toBeInTheDocument();
});

test("renders missing storage status without offline chip", async () => {
  vi.mocked(api.getCamerasAdmin).mockResolvedValue({
    status: "success",
    response: {
      cameras: [
        {
          id: 1,
          uuid: "abc-123",
          shortName: "Lobby",
          description: "Main entrance",
          onvifBaseUrl: "http://192.168.1.50/onvif/device_service",
          hasCredentials: false,
          streams: [
            {
              id: 10,
              type: "main",
              mode: "record",
              rtspUrl: "rtsp://192.168.1.50/main",
              rtspTransport: "tcp",
              sampleFileDirId: null,
              retainBytes: 50_000_000_000,
              flushIfSec: 5,
            },
          ],
        },
      ],
    },
  } as api.FetchResult<api.GetCamerasAdminResponse>);

  renderWithCtx(<CameraConfig csrf="token" />);

  expect(await screen.findAllByText("Needs storage")).not.toHaveLength(0);
  expect(screen.getByText("main: select a storage directory")).toBeInTheDocument();
  expect(screen.queryByText("OFFLINE")).not.toBeInTheDocument();
});
