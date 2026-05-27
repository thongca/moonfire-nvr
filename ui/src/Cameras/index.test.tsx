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

test("shows Stitch camera status and stream badges", async () => {
  server.use(
    http.get("/api/cameras", () =>
      HttpResponse.json({
        cameras: [
          {
            id: 1,
            uuid: "front-door",
            shortName: "Front Door",
            description: "Entrance camera",
            onvifBaseUrl: "http://192.168.1.10/onvif",
            hasCredentials: true,
            streams: [
              {
                id: 11,
                type: "main",
                mode: "record",
                rtspUrl: "rtsp://camera/main",
                rtspTransport: "tcp",
                sampleFileDirId: 7,
              },
            ],
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

  expect(await screen.findByText("Front Door")).toBeInTheDocument();
  expect(screen.getByText("Online")).toBeInTheDocument();
  expect(screen.getByText("MAIN REC")).toBeInTheDocument();
  expect(screen.getByText("192.168.1.10")).toBeInTheDocument();
  expect(screen.getByText("Dir 7")).toBeInTheDocument();
  expect(screen.getByText("Garage")).toBeInTheDocument();
  expect(screen.getByText("Offline")).toBeInTheDocument();
});
