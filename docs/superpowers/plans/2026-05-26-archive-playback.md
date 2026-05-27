# Archive Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real `/archive` playback page for camera recordings with camera/date selection, recording list, video playback, timeline seeking, and clip export.

**Architecture:** Create a focused `ui/src/Archive/` feature folder. `ArchiveActivity` owns page state and data fetching; child components handle top controls, video playback, timeline interaction, recording list, and export. The page reuses `api.recordings`, `api.recordingUrl`, and `combine()` from the existing recording list implementation.

**Tech Stack:** React, TypeScript, MUI, MUI X date pickers, date-fns/date-fns-tz, Vitest, Testing Library, MSW.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `ui/src/Archive/index.tsx` | Create | State container, recording fetch, layout shell |
| `ui/src/Archive/TopBar.tsx` | Create | Title, date picker, live time display, camera chips |
| `ui/src/Archive/VideoPlayer.tsx` | Create | Video element, overlays, playback controls |
| `ui/src/Archive/TimelineScrubber.tsx` | Create | Recording segments, playhead, seek by click/drag, zoom |
| `ui/src/Archive/RecordingList.tsx` | Create | Right-side recording list and export CTA |
| `ui/src/Archive/ExportDialog.tsx` | Create | Trim inputs, timestamp option, download URL generation |
| `ui/src/Archive/Archive.test.tsx` | Create | Integration tests for the Archive flow |
| `ui/src/App.tsx` | Modify | Route `/archive` and root path to ArchiveActivity |

---

### Task 1: Create Archive page shell and data fetch

**Files:**
- Create: `ui/src/Archive/index.tsx`

- [ ] **Step 1: Implement `ArchiveActivity` state container**

Create `ui/src/Archive/index.tsx` with:

```tsx
// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import React, { useEffect, useMemo, useState } from "react";
import { toZonedTime } from "date-fns-tz";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import Box from "@mui/material/Box";
import * as api from "../api";
import { Camera } from "../types";
import { CombinedRecording, combine } from "../List/VideoList";
import { FrameProps } from "../App";
import ExportDialog from "./ExportDialog";
import RecordingList from "./RecordingList";
import TimelineScrubber, { ZoomLevel, ZOOM_WINDOWS_90K } from "./TimelineScrubber";
import TopBar from "./TopBar";
import VideoPlayer from "./VideoPlayer";

interface Props {
  Frame: React.ComponentType<FrameProps>;
  toplevel: api.ToplevelResponse;
  timeZoneName: string;
}

export default function ArchiveActivity({ Frame, toplevel, timeZoneName }: Props): React.JSX.Element {
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(toplevel.cameras[0] ?? null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [recordings, setRecordings] = useState<CombinedRecording[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [activeRecording, setActiveRecording] = useState<CombinedRecording | null>(null);
  const [currentTime90k, setCurrentTime90k] = useState<number | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(0);

  useEffect(() => {
    if (!selectedCamera) return;
    const abort = new AbortController();
    setLoadingRecordings(true);

    async function doFetch() {
      const startOfDay = toZonedTime(selectedDate, timeZoneName);
      startOfDay.setHours(0, 0, 0, 0);
      const startTime90k = Math.floor(startOfDay.getTime() * 90);
      const endTime90k = startTime90k + 24 * 60 * 60 * 90000;
      const resp = await api.recordings(
        { cameraUuid: selectedCamera.uuid, stream: "main", startTime90k, endTime90k },
        { signal: abort.signal },
      );
      if (resp.status === "aborted") return;
      setLoadingRecordings(false);
      if (resp.status === "success") {
        resp.response.recordings.sort((a, b) => b.startId - a.startId);
        setRecordings(combine(undefined, resp.response));
      } else {
        setRecordings([]);
      }
    }

    doFetch();
    return () => {
      abort.abort();
      setLoadingRecordings(false);
    };
  }, [selectedCamera, selectedDate, timeZoneName]);

  const viewRange90k = useMemo((): [number, number] => {
    const windowSize = ZOOM_WINDOWS_90K[zoomLevel];
    if (currentTime90k !== null) return [currentTime90k - windowSize / 2, currentTime90k + windowSize / 2];
    if (recordings.length > 0) {
      const earliest = recordings[recordings.length - 1].startTime90k;
      const latest = recordings[0].endTime90k;
      const mid = Math.floor((earliest + latest) / 2);
      return [mid - windowSize / 2, mid + windowSize / 2];
    }
    const startOfDay = toZonedTime(selectedDate, timeZoneName);
    startOfDay.setHours(0, 0, 0, 0);
    const start90k = Math.floor(startOfDay.getTime() * 90);
    return [start90k, start90k + 24 * 60 * 60 * 90000];
  }, [currentTime90k, zoomLevel, recordings, selectedDate, timeZoneName]);

  const handleRecordingEnd = () => {
    if (activeRecording === null) return;
    const idx = recordings.findIndex((r) => r.startId === activeRecording.startId && (r.endId ?? r.startId) === (activeRecording.endId ?? activeRecording.startId));
    if (idx !== -1 && idx + 1 < recordings.length) setActiveRecording(recordings[idx + 1]);
  };

  const handleSeek = (recording: CombinedRecording, time90k: number) => {
    setActiveRecording(recording);
    setCurrentTime90k(time90k);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Frame>
        <Box sx={{ display: "flex", height: "100%", overflow: "hidden" }}>
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
            <TopBar cameras={toplevel.cameras} selectedCamera={selectedCamera} onSelectCamera={setSelectedCamera} selectedDate={selectedDate} onSelectDate={setSelectedDate} currentTime90k={currentTime90k} timeZoneName={timeZoneName} />
            <VideoPlayer activeRecording={activeRecording} camera={selectedCamera} currentTime90k={currentTime90k} timeZoneName={timeZoneName} onTimeUpdate={setCurrentTime90k} onRecordingEnd={handleRecordingEnd} />
            <TimelineScrubber recordings={recordings} activeRecording={activeRecording} currentTime90k={currentTime90k} viewRange90k={viewRange90k} timeZoneName={timeZoneName} onSeek={handleSeek} onZoom={setZoomLevel} zoomLevel={zoomLevel} />
          </Box>
          <RecordingList recordings={recordings} activeRecording={activeRecording} camera={selectedCamera} loading={loadingRecordings} timeZoneName={timeZoneName} onSelect={setActiveRecording} onExport={() => setExportDialogOpen(true)} />
        </Box>
        <ExportDialog open={exportDialogOpen} recording={activeRecording} camera={selectedCamera} streamType="main" timeZoneName={timeZoneName} onClose={() => setExportDialogOpen(false)} />
      </Frame>
    </LocalizationProvider>
  );
}
```

- [ ] **Step 2: Run TypeScript expecting missing component imports**

Run: `cd ui && npx tsc --noEmit`
Expected: FAIL with missing `./TopBar`, `./VideoPlayer`, `./TimelineScrubber`, `./RecordingList`, and `./ExportDialog` modules.

---

### Task 2: Create Archive child components

**Files:**
- Create: `ui/src/Archive/TopBar.tsx`
- Create: `ui/src/Archive/VideoPlayer.tsx`
- Create: `ui/src/Archive/TimelineScrubber.tsx`
- Create: `ui/src/Archive/RecordingList.tsx`
- Create: `ui/src/Archive/ExportDialog.tsx`

- [ ] **Step 1: Add child components**

Implement focused child components with these public interfaces:

```tsx
// TopBar props
interface TopBarProps {
  cameras: Camera[];
  selectedCamera: Camera | null;
  onSelectCamera: (camera: Camera) => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  currentTime90k: number | null;
  timeZoneName: string;
}

// VideoPlayer props
interface VideoPlayerProps {
  activeRecording: CombinedRecording | null;
  camera: Camera | null;
  currentTime90k: number | null;
  timeZoneName: string;
  onTimeUpdate: (time90k: number) => void;
  onRecordingEnd: () => void;
}

// TimelineScrubber props
export type ZoomLevel = 0 | 1 | 2 | 3;
export const ZOOM_WINDOWS_90K = [1 * 60 * 60 * 90000, 4 * 60 * 60 * 90000, 8 * 60 * 60 * 90000, 24 * 60 * 60 * 90000] as const;
interface TimelineScrubberProps {
  recordings: CombinedRecording[];
  activeRecording: CombinedRecording | null;
  currentTime90k: number | null;
  viewRange90k: [number, number];
  timeZoneName: string;
  onSeek: (recording: CombinedRecording, time90k: number) => void;
  onZoom: (level: ZoomLevel) => void;
  zoomLevel: ZoomLevel;
}

// RecordingList props
interface RecordingListProps {
  recordings: CombinedRecording[];
  activeRecording: CombinedRecording | null;
  camera: Camera | null;
  loading: boolean;
  timeZoneName: string;
  onSelect: (recording: CombinedRecording) => void;
  onExport: () => void;
}

// ExportDialog props
interface ExportDialogProps {
  open: boolean;
  recording: CombinedRecording | null;
  camera: Camera | null;
  streamType: api.StreamType;
  timeZoneName: string;
  onClose: () => void;
}
```

Behavior to implement:
- TopBar renders title `Xem lại bản ghi`, date picker, current time, and `CAM 01`, `CAM 02` chips.
- VideoPlayer renders empty text `Chọn một bản ghi để phát` until a row/timeline segment is selected, then uses `api.recordingUrl(camera.uuid, "main", activeRecording, false)` for video src.
- TimelineScrubber renders recording segments, playhead, hour labels, zoom buttons, and calls `onSeek` when the user clicks or drags inside a segment.
- RecordingList renders each recording as `Bản ghi hệ thống`, shows `{recordings.length} đoạn phim`, and disables `Thiết lập xuất dữ liệu` when no recording is active.
- ExportDialog initializes trim inputs to the recording bounds, validates `HH:mm:ss`, and opens `api.recordingUrl(camera.uuid, streamType, recording, timestampTrack, [trimStart90k, trimEnd90k])` in a new tab.

- [ ] **Step 2: Run TypeScript expecting route not yet wired**

Run: `cd ui && npx tsc --noEmit`
Expected: PASS for Archive component types, or FAIL only because `ArchiveActivity` is not yet routed/imported.

---

### Task 3: Add route and integration tests

**Files:**
- Modify: `ui/src/App.tsx`
- Create: `ui/src/Archive/Archive.test.tsx`

- [ ] **Step 1: Wire the Archive route**

Modify `ui/src/App.tsx`:

```tsx
import ArchiveActivity from "./Archive";
```

Replace the root route element with:

```tsx
<ArchiveActivity toplevel={toplevel} timeZoneName={timeZoneName!} Frame={Frame} />
```

Add an explicit archive route:

```tsx
<Route path="archive" element={<ArchiveActivity toplevel={toplevel} timeZoneName={timeZoneName!} Frame={Frame} />} />
```

- [ ] **Step 2: Add integration tests**

Create `ui/src/Archive/Archive.test.tsx` covering:
- camera chips render from `toplevel.cameras`
- recordings fetch on mount and count appears
- clicking a second camera refetches recordings
- clicking a recording row sets a video src containing `/api/cameras/` and `view.mp4`
- export button is disabled before a recording is active
- export dialog opens after selecting a recording and clicking `Thiết lập xuất dữ liệu`

- [ ] **Step 3: Run focused tests**

Run: `cd ui && npx vitest run src/Archive/Archive.test.tsx`
Expected: PASS.

---

### Task 4: Validate the UI package

**Files:**
- No new files.

- [ ] **Step 1: Run full UI tests**

Run: `cd ui && npx vitest run`
Expected: PASS.

- [ ] **Step 2: Run TypeScript check**

Run: `cd ui && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run the development server and manually verify**

Run: `cd ui && npm run dev -- --host 127.0.0.1`
Expected: Vite dev server starts. Open the app in a browser, visit `/archive`, verify camera chips, recording list, playback selection, timeline seek, and export dialog render. If backend test data is unavailable, report that manual playback could not be fully verified.

---

## Self-Review Checklist

- [x] Spec coverage: page shell, camera/date filters, recording fetch, recording list, video src, timeline seek/zoom, export dialog, tests, route wiring.
- [x] Placeholder scan: no TBD/TODO/fill-in-later items.
- [x] Type consistency: all child component props match `ArchiveActivity`; `api.recordingUrl` and `api.recordings` signatures match `ui/src/api.ts`.
- [x] Scope check: this plan is limited to Archive/Playback and does not include dashboard, camera CRUD, auth, or server route changes.
