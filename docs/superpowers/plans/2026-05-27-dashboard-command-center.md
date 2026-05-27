# Dashboard Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current basic Dashboard with a Stitch-inspired Command Center that uses real Moonfire API data and clearly labeled empty states.

**Architecture:** Keep the redesign in `ui/src/Dashboard.tsx` as focused local components and helper functions. Derive all dashboard statistics from `api.ToplevelResponse`, avoiding fake telemetry and showing placeholders when the current API lacks time-series or recent-thumbnail data.

**Tech Stack:** React 19, TypeScript, Material UI v7, React Router, Vitest, Testing Library, Vite.

---

## File Structure

- Modify `ui/src/Dashboard.tsx`: replace the current management coverage/cards dashboard with the Command Center layout, local components, and derived-data helpers.
- Modify `ui/src/Dashboard.test.tsx`: replace the old management coverage test with tests for Command Center title, KPI data, no-recent-recording feed cards, Quick Management, and report placeholder.
- No new files are required unless `Dashboard.tsx` becomes unwieldy during execution; prefer keeping this as one focused screen file.

---

### Task 1: Add Command Center tests

**Files:**
- Modify: `ui/src/Dashboard.test.tsx`

- [ ] **Step 1: Replace the existing Dashboard test file with failing Command Center tests**

Write this complete file to `ui/src/Dashboard.test.tsx`:

```tsx
// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import { screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import DashboardActivity from "./Dashboard";
import { FrameProps } from "./App";
import { renderWithCtx } from "./testutil";
import type * as api from "./api";
import type { Camera, Stream } from "./types";

const Frame = ({ children }: FrameProps) => <>{children}</>;

function stream(overrides: Partial<Stream>): Stream {
  return {
    camera: undefined as unknown as Camera,
    id: 1,
    streamType: "main",
    retainBytes: 1000,
    minStartTime90k: 0,
    maxEndTime90k: 90_000,
    totalDuration90k: 90_000,
    totalSampleFileBytes: 500,
    fsBytes: 750,
    days: {},
    record: true,
    ...overrides,
  };
}

const frontDoorMain = stream({
  id: 1,
  streamType: "main",
  record: true,
  totalDuration90k: 180_000,
  totalSampleFileBytes: 1500,
  fsBytes: 2500,
});

const frontDoorSub = stream({
  id: 2,
  streamType: "sub",
  record: false,
  totalDuration90k: 90_000,
  totalSampleFileBytes: 500,
  fsBytes: 750,
});

const TOPLEVEL: api.ToplevelResponse = {
  timeZoneName: "UTC",
  serverVersion: "0.0.0",
  cameras: [
    {
      uuid: "front-door",
      shortName: "Front Door",
      description: "Entrance",
      streams: {
        main: frontDoorMain,
        sub: frontDoorSub,
      },
    },
    {
      uuid: "garage",
      shortName: "Garage",
      description: "Garage",
      streams: {},
    },
  ],
  streams: new Map(),
  permissions: {
    adminUsers: true,
    readCameraConfigs: true,
    updateSignals: true,
    viewVideo: true,
  },
  user: undefined,
};

TOPLEVEL.cameras.forEach((camera) => {
  Object.entries(camera.streams).forEach(([streamType, cameraStream]) => {
    if (cameraStream !== undefined) {
      cameraStream.camera = camera;
      cameraStream.streamType = streamType as "main" | "sub";
      TOPLEVEL.streams.set(cameraStream.id, cameraStream);
    }
  });
});

test("renders the command center title and live sync", () => {
  renderWithCtx(<DashboardActivity toplevel={TOPLEVEL} Frame={Frame} />);

  expect(screen.getByRole("heading", { name: "System Overview" })).toBeInTheDocument();
  expect(screen.getByText("Infrastructure monitoring and recording telemetry")).toBeInTheDocument();
  expect(screen.getByText(/Live Sync/i)).toBeInTheDocument();
});

test("derives KPI cards from toplevel API data", () => {
  renderWithCtx(<DashboardActivity toplevel={TOPLEVEL} Frame={Frame} />);

  expect(screen.getByText("Cameras")).toBeInTheDocument();
  expect(screen.getByText("2")).toBeInTheDocument();
  expect(screen.getByText("1 / 2 recording")).toBeInTheDocument();
  expect(screen.getByText("Recording Load")).toBeInTheDocument();
  expect(screen.getByText("50%")).toBeInTheDocument();
  expect(screen.getByText("Storage Used")).toBeInTheDocument();
  expect(screen.getByText("3.3 KB")).toBeInTheDocument();
  expect(screen.getByText("2.0 KB recorded samples")).toBeInTheDocument();
  expect(screen.getByText("Activity Status")).toBeInTheDocument();
  expect(screen.getByText("No active signals")).toBeInTheDocument();
});

test("shows priority feed cards with no recent recording state", () => {
  renderWithCtx(<DashboardActivity toplevel={TOPLEVEL} Frame={Frame} />);

  expect(screen.getByRole("heading", { name: "Priority Feeds" })).toBeInTheDocument();
  const frontDoor = screen.getByTestId("feed-card-front-door");
  expect(within(frontDoor).getByText("Front Door")).toBeInTheDocument();
  expect(within(frontDoor).getByText("No recent recording")).toBeInTheDocument();
  expect(within(frontDoor).getByText("1 recording stream")).toBeInTheDocument();

  const garage = screen.getByTestId("feed-card-garage");
  expect(within(garage).getByText("Garage")).toBeInTheDocument();
  expect(within(garage).getByText("No recent recording")).toBeInTheDocument();
  expect(within(garage).getByText("0 recording streams")).toBeInTheDocument();
});

test("lists cameras in quick management", () => {
  renderWithCtx(<DashboardActivity toplevel={TOPLEVEL} Frame={Frame} />);

  expect(screen.getByRole("heading", { name: "Quick Management" })).toBeInTheDocument();
  const quickManagement = screen.getByTestId("quick-management");
  expect(within(quickManagement).getByText("Front Door")).toBeInTheDocument();
  expect(within(quickManagement).getByText("Garage")).toBeInTheDocument();
  expect(within(quickManagement).getByText("1 active / 2 streams")).toBeInTheDocument();
  expect(within(quickManagement).getByText("0 active / 0 streams")).toBeInTheDocument();
});

test("shows report placeholder when time-series data is unavailable", () => {
  renderWithCtx(<DashboardActivity toplevel={TOPLEVEL} Frame={Frame} />);

  expect(screen.getByRole("heading", { name: "24h Activity Report" })).toBeInTheDocument();
  expect(screen.getByText("Recording activity history not available yet")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the Dashboard test and verify it fails**

Run:

```bash
npm --prefix ui test -- Dashboard.test.tsx --run
```

Expected: FAIL because `System Overview`, `Live Sync`, Command Center KPI labels, feed-card test ids, Quick Management, and report placeholder are not implemented yet.

- [ ] **Step 3: Commit the failing tests**

Only commit if the user has explicitly approved committing in this session. If committing is approved, run:

```bash
git add ui/src/Dashboard.test.tsx
git commit -m "test: specify dashboard command center behavior"
```

---

### Task 2: Implement derived dashboard data helpers

**Files:**
- Modify: `ui/src/Dashboard.tsx`

- [ ] **Step 1: Add helper types and functions near the top of `Dashboard.tsx`**

In `ui/src/Dashboard.tsx`, keep the existing license header/imports, then define these helpers after the `Props` interface. Use imports from Material UI as needed in Task 3; this task focuses on pure data helpers.

```tsx
interface DashboardStats {
  cameras: api.ToplevelResponse["cameras"];
  streams: NonNullable<api.ToplevelResponse["cameras"][number]["streams"]["main"]>[];
  activeStreams: number;
  storageBytes: number;
  sampleBytes: number;
  recordingLoadPercent: number;
}

interface CameraHealth {
  camera: api.ToplevelResponse["cameras"][number];
  streams: NonNullable<api.ToplevelResponse["cameras"][number]["streams"]["main"]>[];
  activeStreams: number;
  status: "recording" | "idle";
}

const formatCount = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

const formatBytes = (bytes: number) => {
  if (bytes < 1000) return `${bytes} bytes`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
};

const getStreams = (camera: api.ToplevelResponse["cameras"][number]) =>
  Object.values(camera.streams).filter(
    (stream): stream is NonNullable<typeof stream> => stream !== undefined,
  );

const getCameraHealth = (
  camera: api.ToplevelResponse["cameras"][number],
): CameraHealth => {
  const streams = getStreams(camera);
  const activeStreams = streams.filter((stream) => stream.record).length;
  return {
    camera,
    streams,
    activeStreams,
    status: activeStreams > 0 ? "recording" : "idle",
  };
};

const getDashboardStats = (toplevel: api.ToplevelResponse): DashboardStats => {
  const cameras = toplevel.cameras;
  const streams = cameras.flatMap(getStreams);
  const activeStreams = streams.filter((stream) => stream.record).length;
  const storageBytes = streams.reduce((total, stream) => total + stream.fsBytes, 0);
  const sampleBytes = streams.reduce(
    (total, stream) => total + stream.totalSampleFileBytes,
    0,
  );
  return {
    cameras,
    streams,
    activeStreams,
    storageBytes,
    sampleBytes,
    recordingLoadPercent:
      streams.length === 0 ? 0 : Math.round((activeStreams / streams.length) * 100),
  };
};
```

- [ ] **Step 2: Run typecheck through build and verify expected failures remain UI-related**

Run:

```bash
npm --prefix ui run build
```

Expected: either PASS if helpers are unused without issue, or FAIL only for straightforward unused/import issues introduced by this task. Fix unused helper/import problems before moving on.

---

### Task 3: Implement Command Center layout and components

**Files:**
- Modify: `ui/src/Dashboard.tsx`

- [ ] **Step 1: Replace the old Dashboard body with the Command Center components**

Use this component structure in `ui/src/Dashboard.tsx`. Keep the helper functions from Task 2. Update imports to include only MUI components used below:

```tsx
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link } from "react-router";
import * as api from "./api";
import { FrameProps } from "./App";
import { shellTokens } from "./theme";
```

Then replace `DashboardActivity` and add local components with this implementation:

```tsx
function MetricCard({
  title,
  value,
  detail,
  accent = false,
}: {
  title: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <Card
      sx={{
        height: "100%",
        border: `1px solid ${accent ? shellTokens.primary.fireOrange : shellTokens.border.subtle}`,
        background: shellTokens.surface.raised,
      }}
    >
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h3" component="p" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
        <Typography color="text.secondary">{detail}</Typography>
      </CardContent>
    </Card>
  );
}

function CameraFeedCard({ health }: { health: CameraHealth }) {
  return (
    <Card
      data-testid={`feed-card-${health.camera.uuid}`}
      sx={{
        minHeight: 220,
        border: `1px solid ${shellTokens.border.subtle}`,
        background: `linear-gradient(180deg, ${shellTokens.surface.overlay}, ${shellTokens.surface.panel})`,
      }}
    >
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Chip size="small" label={health.status === "recording" ? "REC" : "IDLE"} color={health.status === "recording" ? "primary" : "default"} />
          <Typography variant="caption" color="text.secondary">
            {formatCount(health.activeStreams, "recording stream", "recording streams")}
          </Typography>
        </Stack>
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", border: `1px dashed ${shellTokens.border.subtle}`, borderRadius: 1, mb: 2 }}>
          <Typography color="text.secondary">No recent recording</Typography>
        </Box>
        <Typography variant="h6" component="h3">
          {health.camera.shortName}
        </Typography>
        <Typography color="text.secondary">{health.camera.description}</Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button component={Link} to="/archive" size="small">Open Archive</Button>
          <Button component={Link} to="/cameras" size="small">Manage Camera</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function PriorityFeeds({ cameraHealth }: { cameraHealth: CameraHealth[] }) {
  return (
    <Box>
      <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 700 }}>
        Priority Feeds
      </Typography>
      {cameraHealth.length === 0 ? (
        <Card sx={{ border: `1px solid ${shellTokens.border.subtle}` }}>
          <CardContent>
            <Typography variant="h6">No cameras configured</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Add cameras to populate priority feeds.
            </Typography>
            <Button component={Link} to="/cameras" variant="contained">Manage Cameras</Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={1.5}>
          {cameraHealth.map((health) => (
            <Grid key={health.camera.uuid} size={{ xs: 12, md: 6 }}>
              <CameraFeedCard health={health} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

function QuickManagement({ cameraHealth }: { cameraHealth: CameraHealth[] }) {
  return (
    <Card data-testid="quick-management" sx={{ border: `1px solid ${shellTokens.border.subtle}`, height: "100%" }}>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 700 }}>
          Quick Management
        </Typography>
        <Stack spacing={1.5}>
          {cameraHealth.length === 0 ? (
            <Typography color="text.secondary">No cameras configured</Typography>
          ) : (
            cameraHealth.map((health) => (
              <Box key={health.camera.uuid} sx={{ border: `1px solid ${shellTokens.border.subtle}`, borderRadius: 1, p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{health.camera.shortName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {health.activeStreams} active / {health.streams.length} streams
                    </Typography>
                  </Box>
                  <Chip size="small" label={health.status === "recording" ? "Recording" : "Idle"} color={health.status === "recording" ? "primary" : "default"} />
                </Stack>
              </Box>
            ))
          )}
        </Stack>
        <Button component={Link} to="/cameras" fullWidth sx={{ mt: 2 }} variant="outlined">
          Manage All ({cameraHealth.length})
        </Button>
      </CardContent>
    </Card>
  );
}

function ActivityReport() {
  return (
    <Card sx={{ border: `1px solid ${shellTokens.border.subtle}` }}>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 1, fontWeight: 700 }}>
          24h Activity Report
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Recording activity history not available yet
        </Typography>
        <Box sx={{ display: "flex", alignItems: "end", gap: 0.75, height: 96, opacity: 0.35 }}>
          {Array.from({ length: 24 }, (_, index) => (
            <Box key={index} sx={{ flex: 1, height: `${20 + ((index * 17) % 56)}%`, background: shellTokens.primary.fireOrange, borderRadius: "2px 2px 0 0" }} />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardActivity({ toplevel, Frame }: Props) {
  const stats = getDashboardStats(toplevel);
  const cameraHealth = stats.cameras.map(getCameraHealth);
  const inactiveCameras = cameraHealth.filter((health) => health.activeStreams === 0).length;
  let liveSync = "unavailable";
  try {
    liveSync = new Intl.DateTimeFormat("en-US", {
      timeZone: toplevel.timeZoneName,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    }).format(new Date());
  } catch {
    liveSync = new Date().toISOString().slice(11, 19) + " UTC";
  }

  return (
    <Frame>
      <Container maxWidth={false} sx={{ py: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 800 }}>
              System Overview
            </Typography>
            <Typography color="text.secondary">Infrastructure monitoring and recording telemetry</Typography>
          </Box>
          <Chip label={`Live Sync: ${liveSync}`} variant="outlined" sx={{ alignSelf: { xs: "flex-start", md: "center" } }} />
        </Stack>

        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard title="Cameras" value={`${stats.cameras.length}`} detail={`${stats.activeStreams} / ${stats.streams.length} recording`} accent />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard title="Recording Load" value={`${stats.recordingLoadPercent}%`} detail={formatCount(stats.streams.length, "stream total", "streams total")} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard title="Storage Used" value={formatBytes(stats.storageBytes)} detail={`${formatBytes(stats.sampleBytes)} recorded samples`} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard title="Activity Status" value={inactiveCameras === 0 ? "Nominal" : `${inactiveCameras} idle`} detail="No active signals" />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <PriorityFeeds cameraHealth={cameraHealth} />
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <QuickManagement cameraHealth={cameraHealth} />
          </Grid>
          <Grid size={{ xs: 12, lg: 8 }}>
            <ActivityReport />
          </Grid>
        </Grid>
      </Container>
    </Frame>
  );
}
```

- [ ] **Step 2: Run Dashboard tests**

Run:

```bash
npm --prefix ui test -- Dashboard.test.tsx --run
```

Expected: PASS. If it fails because Testing Library matches duplicate text such as camera names, scope assertions with `within(...)` as shown in Task 1 rather than weakening the UI.

- [ ] **Step 3: Run build**

Run:

```bash
npm --prefix ui run build
```

Expected: PASS. Existing Vite chunk-size warnings are acceptable; TypeScript errors are not.

- [ ] **Step 4: Commit implementation**

Only commit if the user has explicitly approved committing in this session. If committing is approved, run:

```bash
git add ui/src/Dashboard.tsx ui/src/Dashboard.test.tsx
git commit -m "feat: redesign dashboard as command center"
```

---

### Task 4: Browser verification against the local backend

**Files:**
- No file changes expected.

- [ ] **Step 1: Ensure local backend is running**

Run:

```bash
ss -ltnp | grep ':8080' || server/target/debug/moonfire-nvr run --config .claude/local-nvr/moonfire-nvr.toml
```

Expected: backend listens on `127.0.0.1:8080`. If the command starts the backend in foreground, stop it and restart it as a background task through the tool harness before browser verification.

- [ ] **Step 2: Ensure Vite dev server is running on the requested URL**

Run:

```bash
ss -ltnp | grep ':5175' || npm --prefix ui run dev -- --host 0.0.0.0 --port 5175
```

Expected: Vite listens on `0.0.0.0:5175`. If the command starts Vite in foreground, stop it and restart it as a background task through the tool harness before browser verification.

- [ ] **Step 3: Verify API proxy returns real data**

Run:

```bash
curl -i --max-time 5 'http://10.20.0.201:5175/api/?days=true'
```

Expected: `HTTP/1.1 200 OK` with JSON containing `cameras`, `permissions`, and `timeZoneName`.

- [ ] **Step 4: Verify Dashboard in browser**

Open:

```text
http://10.20.0.201:5175/#/
```

Expected:

- Page title remains `Moonfire NVR`.
- Dashboard shows `System Overview`.
- KPI cards show Cameras, Recording Load, Storage Used, and Activity Status.
- Priority Feeds shows either camera cards or the no-cameras empty state.
- Quick Management shows camera status or `No cameras configured`.
- 24h Activity Report shows `Recording activity history not available yet`.
- Browser console has no errors.

---

## Self-Review

- Spec coverage: The plan covers the Stitch Command Center layout, honest data mapping, Priority Feeds no-recent-recording state, Quick Management, report placeholder, tests, build, and browser verification.
- Placeholder scan: The plan avoids TBD/TODO/later placeholders. The report placeholder is an intentional product state with exact copy.
- Type consistency: Helper names and component names are consistent across tasks. `CameraHealth`, `DashboardStats`, `getDashboardStats`, and `getCameraHealth` are defined before use.
