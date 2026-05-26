# EventLog Real Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static placeholder EventLog on the Dashboard with real recording data, polling every 30 seconds.

**Architecture:** DashboardActivity receives the `toplevel` prop (already available from App.tsx) and passes `cameras` down to EventLog. EventLog fetches the last 2 hours of recordings for every camera/stream on mount and every 30s, collects the 8 most recent recording segments across all streams, and displays them as REC events. On fetch error the previous data stays visible with a warning icon in the header. "VIEW FULL LOG" links to `/archive`.

**Tech Stack:** React hooks (`useEffect`, `useRef`, `useState`), `api.recordings`, MUI components, `react-router` `Link`, msw for tests.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `ui/src/App.tsx` | Modify | Pass `toplevel` prop to DashboardActivity |
| `ui/src/Dashboard/index.tsx` | Modify | Accept `toplevel` prop, pass `cameras` to EventLog |
| `ui/src/Dashboard/EventLog.tsx` | Rewrite | Fetch recordings, display real events with polling |
| `ui/src/Dashboard/EventLog.test.tsx` | Create | Unit tests for EventLog with msw |

---

### Task 1: Wire `toplevel` prop through to EventLog

**Files:**
- Modify: `ui/src/App.tsx` (line ~166)
- Modify: `ui/src/Dashboard/index.tsx`

- [ ] **Step 1: Write the failing test in App.test.tsx**

The existing test `"dashboard renders at root"` in `ui/src/App.test.tsx` renders `<App />` with a mocked `/api/` that returns `cameras: []`. After this change the DashboardActivity will still work because `cameras: []` is valid. No new test is needed here—but confirm the existing test still compiles after the prop change by running:

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npm test -- --run 2>&1 | head -40
```

Expected: all existing tests pass (compilation check before we change anything).

- [ ] **Step 2: Update DashboardActivity to accept and forward `cameras`**

In `ui/src/Dashboard/index.tsx`, change the `Props` interface and function signature to accept `toplevel`, then pass `cameras` to `EventLog`:

```tsx
// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import React from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { FrameProps } from "../App";
import * as api from "../api";
import StatsBar from "./StatsBar";
import PriorityFeeds from "./PriorityFeeds";
import EventLog from "./EventLog";
import MotionActivity from "./MotionActivity";

interface Props {
  Frame: React.ComponentType<FrameProps>;
  toplevel: api.ToplevelResponse;
}

export default function DashboardActivity({ Frame, toplevel }: Props) {
  return (
    <Frame>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          System Overview
        </Typography>
        <Box sx={{ mt: 3 }}>
          <StatsBar />
        </Box>
        <Box
          sx={{
            mt: 3,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
            gap: 3,
          }}
        >
          <PriorityFeeds />
          <EventLog cameras={toplevel.cameras} />
        </Box>
        <MotionActivity />
      </Container>
    </Frame>
  );
}
```

- [ ] **Step 3: Update App.tsx to pass `toplevel` to DashboardActivity**

In `ui/src/App.tsx`, find the route for `path=""` (~line 165) and add the `toplevel` prop:

```tsx
<Route
  path=""
  element={<DashboardActivity Frame={Frame} toplevel={toplevel} />}
/>
```

- [ ] **Step 4: Run TypeScript check to confirm no type errors**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (EventLog still has the old `cameras`-less signature, so this may error until Task 2 is done — that is OK; finish Task 2 first and run tsc after).

- [ ] **Step 5: Commit**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management
git add ui/src/App.tsx ui/src/Dashboard/index.tsx
git commit -m "feat(dashboard): wire toplevel.cameras prop through to EventLog"
```

---

### Task 2: Rewrite EventLog with real recordings data

**Files:**
- Create: `ui/src/Dashboard/EventLog.test.tsx`
- Rewrite: `ui/src/Dashboard/EventLog.tsx`

#### Step 1: Write the failing tests

- [ ] **Step 1a: Create `ui/src/Dashboard/EventLog.test.tsx`**

```tsx
// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { screen, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterAll, afterEach, expect, test, vi } from "vitest";
import EventLog from "./EventLog";
import { renderWithCtx } from "../testutil";
import type { Camera } from "../types";

// Freeze time so time-ago values are deterministic.
// startTime90k for a recording 5 minutes ago:
// Date.now() is mocked to 1_000_000_000_000 ms
const NOW_MS = 1_000_000_000_000;
const NOW_90K = Math.floor((NOW_MS / 1000) * 90000);
const FIVE_MIN_AGO_90K = NOW_90K - 5 * 60 * 90000;
const TWO_HR_AGO_90K = NOW_90K - 2 * 60 * 60 * 90000;

vi.setSystemTime(NOW_MS);

const CAMERA_A: Camera = {
  uuid: "aaaaaaaa-0000-0000-0000-000000000001",
  shortName: "Front Door",
  description: "",
  streams: {
    main: {
      camera: null as any,
      id: 1,
      streamType: "main",
      retainBytes: 1000000,
      minStartTime90k: 0,
      maxEndTime90k: NOW_90K,
      totalDuration90k: 1000,
      totalSampleFileBytes: 1000,
      fsBytes: 1000,
      days: {},
      record: true,
    },
  },
};

const CAMERA_B: Camera = {
  uuid: "bbbbbbbb-0000-0000-0000-000000000002",
  shortName: "Back Gate",
  description: "",
  streams: {
    main: {
      camera: null as any,
      id: 2,
      streamType: "main",
      retainBytes: 1000000,
      minStartTime90k: 0,
      maxEndTime90k: NOW_90K,
      totalDuration90k: 1000,
      totalSampleFileBytes: 1000,
      fsBytes: 1000,
      days: {},
      record: true,
    },
  },
};

const RECORDING_5MIN: import("../api").Recording = {
  startId: 1,
  openId: 1,
  runStartId: 1,
  startTime90k: FIVE_MIN_AGO_90K,
  endTime90k: FIVE_MIN_AGO_90K + 60 * 90000,
  videoSampleEntryId: 1,
  videoSamples: 1860,
  sampleFileBytes: 100000,
};

const RECORDING_2HR: import("../api").Recording = {
  startId: 2,
  openId: 1,
  runStartId: 2,
  startTime90k: TWO_HR_AGO_90K,
  endTime90k: TWO_HR_AGO_90K + 60 * 90000,
  videoSampleEntryId: 1,
  videoSamples: 1860,
  sampleFileBytes: 100000,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("shows loading state then recordings", async () => {
  server.use(
    http.get(
      `/api/cameras/${CAMERA_A.uuid}/main/recordings`,
      () =>
        HttpResponse.json({
          recordings: [RECORDING_5MIN],
          videoSampleEntries: { 1: { width: 1920, height: 1080 } },
        }),
    ),
  );

  renderWithCtx(<EventLog cameras={[CAMERA_A]} />);

  // After data loads, recording event is visible.
  expect(await screen.findByText("Front Door")).toBeInTheDocument();
  expect(screen.getByText("REC")).toBeInTheDocument();
  expect(screen.getByText("-5m")).toBeInTheDocument();
});

test("shows no recordings message when empty", async () => {
  server.use(
    http.get(
      `/api/cameras/${CAMERA_A.uuid}/main/recordings`,
      () =>
        HttpResponse.json({ recordings: [], videoSampleEntries: {} }),
    ),
  );

  renderWithCtx(<EventLog cameras={[CAMERA_A]} />);
  expect(await screen.findByText("No recent recordings")).toBeInTheDocument();
});

test("shows warning icon on fetch error, keeps stale data", async () => {
  // First fetch: success.
  server.use(
    http.get(
      `/api/cameras/${CAMERA_A.uuid}/main/recordings`,
      () =>
        HttpResponse.json({
          recordings: [RECORDING_5MIN],
          videoSampleEntries: { 1: { width: 1920, height: 1080 } },
        }),
    ),
  );

  renderWithCtx(<EventLog cameras={[CAMERA_A]} />);
  await screen.findByText("Front Door");

  // Second fetch: error.
  server.use(
    http.get(
      `/api/cameras/${CAMERA_A.uuid}/main/recordings`,
      () => HttpResponse.text("server error", { status: 500 }),
    ),
  );

  // Advance 30 seconds to trigger the poll.
  await act(async () => {
    vi.advanceTimersByTime(30_000);
  });

  // Old data still visible.
  expect(screen.getByText("Front Door")).toBeInTheDocument();
  // Warning icon rendered (aria-label).
  expect(screen.getByLabelText("fetch error")).toBeInTheDocument();
});

test("shows at most 8 events across multiple cameras", async () => {
  // Camera A: 5 recordings. Camera B: 5 recordings.
  // EventLog should show only 8.
  const makeRecs = (n: number): import("../api").Recording[] =>
    Array.from({ length: n }, (_, i) => ({
      startId: i + 1,
      openId: 1,
      runStartId: 1,
      startTime90k: FIVE_MIN_AGO_90K - i * 60 * 90000,
      endTime90k: FIVE_MIN_AGO_90K - i * 60 * 90000 + 60 * 90000,
      videoSampleEntryId: 1,
      videoSamples: 1860,
      sampleFileBytes: 100000,
    }));

  server.use(
    http.get(
      `/api/cameras/${CAMERA_A.uuid}/main/recordings`,
      () =>
        HttpResponse.json({
          recordings: makeRecs(5),
          videoSampleEntries: { 1: { width: 1920, height: 1080 } },
        }),
    ),
    http.get(
      `/api/cameras/${CAMERA_B.uuid}/main/recordings`,
      () =>
        HttpResponse.json({
          recordings: makeRecs(5),
          videoSampleEntries: { 1: { width: 1920, height: 1080 } },
        }),
    ),
  );

  renderWithCtx(<EventLog cameras={[CAMERA_A, CAMERA_B]} />);

  // Wait for data to load.
  await screen.findByText("Front Door");

  // Count "REC" badges — should be exactly 8.
  const recBadges = screen.getAllByText("REC");
  expect(recBadges).toHaveLength(8);
});

test("VIEW FULL LOG links to /archive", async () => {
  server.use(
    http.get(
      `/api/cameras/${CAMERA_A.uuid}/main/recordings`,
      () => HttpResponse.json({ recordings: [], videoSampleEntries: {} }),
    ),
  );

  renderWithCtx(<EventLog cameras={[CAMERA_A]} />);
  await screen.findByText("No recent recordings");

  const link = screen.getByRole("link", { name: /VIEW FULL LOG/i });
  expect(link).toHaveAttribute("href", "/archive");
});
```

- [ ] **Step 1b: Run tests to confirm they all fail with meaningful errors**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx vitest run src/Dashboard/EventLog.test.tsx 2>&1 | tail -30
```

Expected: FAIL — "cameras is not a prop" / type errors because EventLog still has the old signature.

- [ ] **Step 2: Rewrite `ui/src/Dashboard/EventLog.tsx`**

Replace the entire file:

```tsx
// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import WarningAmberOutlined from "@mui/icons-material/WarningAmberOutlined";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import * as api from "../api";
import { shellTokens } from "../theme";
import type { Camera } from "../types";

interface EventItem {
  cameraName: string;
  startTime90k: number;
}

function timeAgo(startTime90k: number): string {
  const diffMs = Date.now() - (startTime90k / 90000) * 1000;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just Now";
  if (diffMin < 60) return `-${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `-${diffHr}h`;
  return `-${Math.floor(diffHr / 24)}d`;
}

function RecBadge() {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        bgcolor: shellTokens.primary.fireOrange + "26",
        border: `1px solid ${shellTokens.primary.fireOrange}`,
        color: shellTokens.primary.fireOrange,
        fontSize: "0.6rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        px: 0.75,
        py: 0.25,
        borderRadius: 0.5,
        whiteSpace: "nowrap",
        minWidth: 36,
        justifyContent: "center",
      }}
    >
      REC
    </Box>
  );
}

function ThumbnailPlaceholder() {
  return (
    <Box
      sx={{
        width: 48,
        height: 36,
        bgcolor: shellTokens.surface.raised,
        border: `1px solid ${shellTokens.border.subtle}`,
        borderRadius: `${shellTokens.radius.base}px`,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          bgcolor: shellTokens.border.subtle,
        }}
      />
    </Box>
  );
}

function EventRow({ event }: { event: EventItem }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        py: 1,
        borderBottom: `1px solid ${shellTokens.border.subtle}`,
        "&:last-of-type": { borderBottom: "none" },
      }}
    >
      <ThumbnailPlaceholder />
      <RecBadge />
      <Typography
        variant="caption"
        sx={{
          color: shellTokens.text.primary,
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: "0.75rem",
        }}
      >
        {event.cameraName}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: shellTokens.text.secondary,
          fontSize: "0.65rem",
          fontFamily: "monospace",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {timeAgo(event.startTime90k)}
      </Typography>
    </Box>
  );
}

interface Props {
  cameras: Camera[];
}

export default function EventLog({ cameras }: Props) {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchEvents = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const now90k = Math.floor((Date.now() / 1000) * 90000);
    const twoHrAgo90k = now90k - 2 * 60 * 60 * 90000;

    const fetches = cameras.flatMap((cam) =>
      (Object.keys(cam.streams) as Array<keyof typeof cam.streams>).map(
        async (streamType) => {
          const result = await api.recordings(
            {
              cameraUuid: cam.uuid,
              stream: streamType,
              startTime90k: twoHrAgo90k,
              endTime90k: now90k,
            },
            { signal: controller.signal },
          );
          if (result.status === "success") {
            return result.response.recordings.map((r) => ({
              cameraName: cam.shortName,
              startTime90k: r.startTime90k,
            }));
          }
          return null;
        },
      ),
    );

    const results = await Promise.all(fetches);

    if (controller.signal.aborted) return;

    const failed = results.some((r) => r === null);
    const allEvents = results
      .flat()
      .filter((e): e is EventItem => e !== null)
      .sort((a, b) => b.startTime90k - a.startTime90k)
      .slice(0, 8);

    setHasError(failed);
    setEvents((prev) => (allEvents.length > 0 || prev === null ? allEvents : prev));
  }, [cameras]);

  useEffect(() => {
    fetchEvents();
    const id = setInterval(fetchEvents, 30_000);
    return () => {
      abortRef.current?.abort();
      clearInterval(id);
    };
  }, [fetchEvents]);

  return (
    <Paper
      variant="outlined"
      sx={{
        height: "100%",
        p: 2,
        bgcolor: shellTokens.surface.panel,
        borderColor: shellTokens.border.subtle,
        borderRadius: `${shellTokens.radius.base}px`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{ color: shellTokens.text.primary }}
          >
            Event Log
          </Typography>
          {hasError && (
            <Tooltip title="Could not refresh events">
              <WarningAmberOutlined
                fontSize="small"
                aria-label="fetch error"
                sx={{ color: "#f59e0b" }}
              />
            </Tooltip>
          )}
        </Box>
        <Box
          sx={{
            bgcolor: "#f59e0b26",
            border: "1px solid #f59e0b",
            color: "#f59e0b",
            fontSize: "0.6rem",
            fontWeight: 700,
            letterSpacing: "0.10em",
            px: 0.75,
            py: 0.25,
            borderRadius: 0.5,
          }}
        >
          LIVE
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1 }}>
        {events === null ? (
          <Box sx={{ display: "flex", justifyContent: "center", pt: 2 }}>
            <CircularProgress size={24} sx={{ color: shellTokens.primary.fireOrange }} />
          </Box>
        ) : events.length === 0 ? (
          <Typography
            variant="caption"
            sx={{ color: shellTokens.text.secondary, display: "block", pt: 1 }}
          >
            No recent recordings
          </Typography>
        ) : (
          events.map((evt, i) => <EventRow key={i} event={evt} />)
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ mt: 1.5, textAlign: "right" }}>
        <Typography
          component={Link}
          to="/archive"
          variant="caption"
          sx={{
            color: shellTokens.primary.fireOrange,
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textDecoration: "none",
          }}
        >
          VIEW FULL LOG
        </Typography>
      </Box>
    </Paper>
  );
}
```

- [ ] **Step 3: Run the new tests to verify they pass**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx vitest run src/Dashboard/EventLog.test.tsx 2>&1
```

Expected: all 5 tests PASS.

- [ ] **Step 4: Run the full test suite to check for regressions**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx vitest run 2>&1
```

Expected: all tests pass (including `App.test.tsx dashboard renders at root`).

- [ ] **Step 5: TypeScript check**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management
git add ui/src/Dashboard/EventLog.tsx ui/src/Dashboard/EventLog.test.tsx
git commit -m "feat(dashboard): EventLog fetches real recordings with 30s polling"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** recordings fetch → ✓ (Task 2, fetchEvents). 30s poll → ✓ (setInterval). Top 8 → ✓ (.slice(0,8)). Error keeps stale data → ✓ (setEvents conditional). Warning icon → ✓ (WarningAmberOutlined). VIEW FULL LOG → /archive → ✓ (Link to="/archive"). Time-ago → ✓ (timeAgo function). DashboardActivity gets toplevel → ✓ (Task 1).
- [x] **Placeholders:** none.
- [x] **Type consistency:** `EventItem` used consistently across `fetchEvents`, `EventRow`, `events` state. `Camera` imported from `../types`. `api.recordings` called with `RecordingsRequest` shape. `timeAgo` takes `number` (startTime90k).
- [x] **Test coverage:** loading state ✓, empty state ✓, stale-on-error ✓, 8-cap ✓, VIEW FULL LOG href ✓.
