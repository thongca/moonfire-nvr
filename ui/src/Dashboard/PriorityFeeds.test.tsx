// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import PriorityFeeds from "./PriorityFeeds";
import { renderWithCtx } from "../testutil";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return { ...actual, getCamerasAdmin: vi.fn() };
});

import * as api from "../api";

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.clearAllMocks(); localStorage.clear(); });

test("renders Priority Feeds heading and configure button", () => {
  renderWithCtx(<PriorityFeeds />);
  expect(screen.getByText("Priority Feeds")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /configure/i })).toBeInTheDocument();
});

test("shows four empty tiles when localStorage is empty", () => {
  renderWithCtx(<PriorityFeeds />);
  const addButtons = screen.getAllByText("Add Camera");
  expect(addButtons).toHaveLength(4);
});

test("configure button opens modal and shows camera list", async () => {
  vi.mocked(api.getCamerasAdmin).mockResolvedValue({
    status: "success",
    response: {
      cameras: [
        { id: 1, uuid: "abc", shortName: "Front Door", description: "", hasCredentials: false, streams: [] },
      ],
    },
  } as any);

  renderWithCtx(<PriorityFeeds />);
  fireEvent.click(screen.getByRole("button", { name: /configure/i }));
  expect(await screen.findByText("Front Door")).toBeInTheDocument();
});

test("saving configuration persists to localStorage", async () => {
  vi.mocked(api.getCamerasAdmin).mockResolvedValue({
    status: "success",
    response: {
      cameras: [
        { id: 42, uuid: "xyz", shortName: "Lobby", description: "", hasCredentials: false, streams: [] },
      ],
    },
  } as any);

  renderWithCtx(<PriorityFeeds />);
  fireEvent.click(screen.getByRole("button", { name: /configure/i }));
  await screen.findByText("Lobby");

  fireEvent.click(screen.getByRole("checkbox", { name: /lobby/i }));
  fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

  const saved = JSON.parse(localStorage.getItem("nvr.priorityFeeds") ?? "[]");
  expect(saved).toContain(42);
});
