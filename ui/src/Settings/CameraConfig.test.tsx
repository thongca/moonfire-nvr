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
