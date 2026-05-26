# Archive Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old `/archive` route with a 3-column Stitch-themed Archive page featuring a video player, functional timeline scrubber with click/drag seek, a right-panel recording list, and a working export dialog.

**Architecture:** New `ui/src/Archive/` folder with six focused components. `ArchiveActivity` (index.tsx) holds all state and orchestrates data flow. `App.tsx` routes `/archive` to `ArchiveActivity` replacing the existing `ListActivity`. Tests live in `Archive.test.tsx` and cover the full integration flow with MSW mocks.

**Tech Stack:** React 19, MUI v7, `@mui/x-date-pickers` v8, `date-fns` v4 + `date-fns-tz` v3, MSW v2, Vitest v4, Testing Library

---

## File Structure

| File | Created / Modified | Responsibility |
|---|---|---|
| `ui/src/Archive/ExportDialog.tsx` | Create | Trim inputs, timestamp checkbox, download via `window.open` |
| `ui/src/Archive/RecordingList.tsx` | Create | Right panel: recording rows + sticky export CTA |
| `ui/src/Archive/VideoPlayer.tsx` | Create | `<video>` with custom controls + overlays |
| `ui/src/Archive/TimelineScrubber.tsx` | Create | Segment rects, playhead, click/drag seek, zoom controls |
| `ui/src/Archive/TopBar.tsx` | Create | DatePicker, time display, camera chips |
| `ui/src/Archive/index.tsx` | Create | State container, fetch logic, layout shell |
| `ui/src/Archive/Archive.test.tsx` | Create | Integration tests (6 scenarios) |
| `ui/src/App.tsx` | Modify | Route `/archive` → `ArchiveActivity` instead of `ListActivity` |

---

## Task 1: ExportDialog

**Files:**
- Create: `ui/src/Archive/ExportDialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
// ui/src/Archive/ExportDialog.tsx
import React, { useState, useEffect } from "react";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import * as api from "../api";
import type { CombinedRecording } from "../List/VideoList";
import type { Camera } from "../types";

interface Props {
  open: boolean;
  recording: CombinedRecording | null;
  camera: Camera | null;
  timeZoneName: string;
  onClose: () => void;
}

function to90k(date: Date): number {
  return Math.floor(date.getTime() * 90);
}

function ticks90kToDate(time90k: number): Date {
  return new Date(time90k / 90);
}

function formatHHMMSS(time90k: number, tz: string): string {
  return format(toZonedTime(ticks90kToDate(time90k), tz), "HH:mm:ss");
}

function parseHHMMSS(s: string, referenceDate: Date, tz: string): number | null {
  const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1]), min = parseInt(m[2]), sec = parseInt(m[3]);
  if (h > 23 || min > 59 || sec > 59) return null;
  const base = toZonedTime(referenceDate, tz);
  base.setHours(h, min, sec, 0);
  return to90k(base);
}

export default function ExportDialog({ open, recording, camera, timeZoneName, onClose }: Props) {
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");
  const [timestampTrack, setTimestampTrack] = useState(false);

  useEffect(() => {
    if (!recording) return;
    setStartStr(formatHHMMSS(recording.startTime90k, timeZoneName));
    setEndStr(formatHHMMSS(recording.endTime90k, timeZoneName));
    setTimestampTrack(false);
  }, [recording, timeZoneName]);

  if (!recording || !camera) return null;

  const refDate = ticks90kToDate(recording.startTime90k);
  const trimStart = parseHHMMSS(startStr, refDate, timeZoneName);
  const trimEnd = parseHHMMSS(endStr, refDate, timeZoneName);

  const isValid =
    trimStart !== null &&
    trimEnd !== null &&
    trimStart < trimEnd &&
    trimStart >= recording.startTime90k &&
    trimEnd <= recording.endTime90k;

  const handleDownload = () => {
    if (!isValid || trimStart === null || trimEnd === null) return;
    const url = api.recordingUrl(
      camera.uuid,
      "main",
      recording,
      timestampTrack,
      [trimStart, trimEnd],
    );
    window.open(url, "_blank");
  };

  const timeRange = `${formatHHMMSS(recording.startTime90k, timeZoneName)} – ${formatHHMMSS(recording.endTime90k, timeZoneName)}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Xuất đoạn phim</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {camera.shortName} · {timeRange}
          </Typography>
          <TextField
            label="Thời điểm bắt đầu (HH:mm:ss)"
            value={startStr}
            onChange={(e) => setStartStr(e.target.value)}
            error={trimStart === null || (trimStart !== null && trimEnd !== null && trimStart >= trimEnd)}
            size="small"
            fullWidth
          />
          <TextField
            label="Thời điểm kết thúc (HH:mm:ss)"
            value={endStr}
            onChange={(e) => setEndStr(e.target.value)}
            error={trimEnd === null || (trimStart !== null && trimEnd !== null && trimStart >= trimEnd)}
            size="small"
            fullWidth
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={timestampTrack}
                onChange={(e) => setTimestampTrack(e.target.checked)}
              />
            }
            label="Thêm timestamp vào video"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button variant="contained" onClick={handleDownload} disabled={!isValid}>
          Tải xuống
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors for `Archive/ExportDialog.tsx`

- [ ] **Step 3: Commit**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management
git add ui/src/Archive/ExportDialog.tsx
git commit -m "feat(archive): add ExportDialog component"
```

---

## Task 2: RecordingList

**Files:**
- Create: `ui/src/Archive/RecordingList.tsx`

- [ ] **Step 1: Write the component**

```tsx
// ui/src/Archive/RecordingList.tsx
import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { CombinedRecording } from "../List/VideoList";
import type { Camera } from "../types";

interface Props {
  recordings: CombinedRecording[];
  activeRecording: CombinedRecording | null;
  camera: Camera | null;
  loading: boolean;
  timeZoneName: string;
  onSelect: (recording: CombinedRecording) => void;
  onExport: () => void;
}

function formatHHMM(time90k: number, tz: string): string {
  return format(toZonedTime(new Date(time90k / 90), tz), "HH:mm");
}

function formatDuration(rec: CombinedRecording): string {
  const totalSec = Math.floor((rec.endTime90k - rec.startTime90k) / 90000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RecordingList({
  recordings,
  activeRecording,
  camera,
  loading,
  timeZoneName,
  onSelect,
  onExport,
}: Props) {
  return (
    <Box
      sx={{
        width: 300,
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid",
        borderColor: "divider",
        bgcolor: "#1c1b1b",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>
          Danh sách bản ghi
        </Typography>
        {loading && <CircularProgress size={16} />}
      </Box>

      {/* Recording rows */}
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {recordings.map((rec, i) => {
          const active = rec === activeRecording;
          const timeRange = `${formatHHMM(rec.startTime90k, timeZoneName)} - ${formatHHMM(rec.endTime90k, timeZoneName)}`;
          const duration = formatDuration(rec);
          return (
            <Box
              key={`${rec.startId}-${rec.endId ?? rec.startId}`}
              onClick={() => onSelect(rec)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 2,
                py: 1,
                cursor: "pointer",
                bgcolor: active ? "#ff572215" : "transparent",
                borderLeft: active ? "2px solid #ff5722" : "2px solid transparent",
                "&:hover": { bgcolor: active ? "#ff572215" : "#ffffff0a" },
              }}
            >
              {/* Thumbnail placeholder */}
              <Box
                sx={{
                  width: 48,
                  height: 36,
                  bgcolor: "#2a2a2a",
                  borderRadius: "4px",
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    position: "absolute",
                    bottom: 2,
                    right: 3,
                    fontSize: "9px",
                    color: "#fff",
                    lineHeight: 1,
                  }}
                >
                  {duration}
                </Typography>
              </Box>

              {/* Info */}
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    fontFamily: "'JetBrains Mono', monospace",
                    color: active ? "#ff5722" : "text.primary",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {timeRange}
                </Typography>
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
                  Bản ghi hệ thống
                </Typography>
                {camera && (
                  <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
                    {camera.shortName}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Sticky footer */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: "1px solid",
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {recordings.length} đoạn phim
        </Typography>
        <Button
          variant="contained"
          size="small"
          disabled={activeRecording === null}
          onClick={onExport}
          sx={{
            bgcolor: "#ff5722",
            "&:hover": { bgcolor: "#e64a19" },
            "&:disabled": { bgcolor: "#ff572240" },
          }}
        >
          Thiết lập xuất dữ liệu
        </Button>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management
git add ui/src/Archive/RecordingList.tsx
git commit -m "feat(archive): add RecordingList component"
```

---

## Task 3: VideoPlayer

**Files:**
- Create: `ui/src/Archive/VideoPlayer.tsx`

- [ ] **Step 1: Write the component**

```tsx
// ui/src/Archive/VideoPlayer.tsx
import React, { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import FastForwardIcon from "@mui/icons-material/FastForward";
import FastRewindIcon from "@mui/icons-material/FastRewind";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import SkipPreviousIcon from "@mui/icons-material/SkipPrevious";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import * as api from "../api";
import type { CombinedRecording } from "../List/VideoList";
import type { Camera } from "../types";

interface Props {
  activeRecording: CombinedRecording | null;
  camera: Camera | null;
  currentTime90k: number | null;
  timeZoneName: string;
  onTimeUpdate: (time90k: number) => void;
  onRecordingEnd: () => void;
}

export default function VideoPlayer({
  activeRecording,
  camera,
  currentTime90k,
  timeZoneName,
  onTimeUpdate,
  onRecordingEnd,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = React.useState(true);

  const src =
    activeRecording && camera
      ? api.recordingUrl(camera.uuid, "main", activeRecording, false)
      : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    video.src = src;
    video.load();
    video.play().catch(() => {});
  }, [src]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !activeRecording) return;
    const time90k = activeRecording.startTime90k + Math.floor(video.currentTime * 90000);
    onTimeUpdate(time90k);
    setPaused(video.paused);
  };

  const handleEnded = () => {
    setPaused(true);
    onRecordingEnd();
  };

  const seek = (deltaS: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime + deltaS);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    setPaused(video.paused);
  };

  const seekToStart = () => {
    if (videoRef.current) videoRef.current.currentTime = 0;
  };

  const seekToEnd = () => {
    const video = videoRef.current;
    if (!video || !activeRecording) return;
    video.currentTime = (activeRecording.endTime90k - activeRecording.startTime90k) / 90000;
    onRecordingEnd();
  };

  const overlayTimeStr =
    currentTime90k !== null
      ? format(toZonedTime(new Date(currentTime90k / 90), timeZoneName), "HH:mm:ss")
      : "--:--:--";

  const resolutionStr =
    activeRecording
      ? `${activeRecording.width}p`
      : "";

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "#131313",
        minHeight: 0,
      }}
    >
      {/* 16:9 video container */}
      <Box
        sx={{
          flex: 1,
          aspectRatio: "16/9",
          position: "relative",
          bgcolor: "#000",
          overflow: "hidden",
          maxHeight: "calc(100% - 56px)",
        }}
      >
        {activeRecording ? (
          <video
            ref={videoRef}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography color="text.secondary">Chọn một bản ghi để phát</Typography>
          </Box>
        )}

        {/* Top-left overlay: camera name */}
        {camera && (
          <Box
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              bgcolor: "rgba(0,0,0,0.6)",
              borderRadius: "4px",
              px: 1,
              py: 0.25,
            }}
          >
            <Typography variant="caption" sx={{ color: "#fff", fontWeight: 600 }}>
              {camera.shortName}
            </Typography>
          </Box>
        )}

        {/* Top-right overlay: time + resolution */}
        {activeRecording && (
          <Box
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              bgcolor: "rgba(0,0,0,0.6)",
              borderRadius: "4px",
              px: 1,
              py: 0.25,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: "#fff",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {overlayTimeStr} | {resolutionStr}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Custom controls */}
      <Box
        sx={{
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          bgcolor: "#1c1b1b",
        }}
      >
        <IconButton onClick={seekToStart} size="small" disabled={!activeRecording}>
          <SkipPreviousIcon />
        </IconButton>
        <IconButton onClick={() => seek(-10)} size="small" disabled={!activeRecording}>
          <FastRewindIcon />
        </IconButton>
        <IconButton onClick={togglePlay} size="small" disabled={!activeRecording}>
          {paused ? <PlayArrowIcon /> : <PauseIcon />}
        </IconButton>
        <IconButton onClick={() => seek(10)} size="small" disabled={!activeRecording}>
          <FastForwardIcon />
        </IconButton>
        <IconButton onClick={seekToEnd} size="small" disabled={!activeRecording}>
          <SkipNextIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management
git add ui/src/Archive/VideoPlayer.tsx
git commit -m "feat(archive): add VideoPlayer component"
```

---

## Task 4: TimelineScrubber

**Files:**
- Create: `ui/src/Archive/TimelineScrubber.tsx`

- [ ] **Step 1: Write the component**

```tsx
// ui/src/Archive/TimelineScrubber.tsx
import React, { useRef, useCallback } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { CombinedRecording } from "../List/VideoList";

// Zoom level → window size in 90k ticks
const ZOOM_WINDOWS_90K = [
  1 * 60 * 60 * 90000,   // 1h
  4 * 60 * 60 * 90000,   // 4h
  8 * 60 * 60 * 90000,   // 8h
  24 * 60 * 60 * 90000,  // 24h
] as const;

export type ZoomLevel = 0 | 1 | 2 | 3;

interface Props {
  recordings: CombinedRecording[];
  activeRecording: CombinedRecording | null;
  currentTime90k: number | null;
  viewRange90k: [number, number];
  timeZoneName: string;
  onSeek: (recording: CombinedRecording, time90k: number) => void;
  onZoom: (level: ZoomLevel) => void;
  zoomLevel: ZoomLevel;
}

function formatHHMMSS(time90k: number, tz: string): string {
  return format(toZonedTime(new Date(time90k / 90), tz), "HH:mm:ss");
}

function formatHHMM(time90k: number, tz: string): string {
  return format(toZonedTime(new Date(time90k / 90), tz), "HH:mm");
}

export default function TimelineScrubber({
  recordings,
  activeRecording,
  currentTime90k,
  viewRange90k,
  timeZoneName,
  onSeek,
  onZoom,
  zoomLevel,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const [viewStart, viewEnd] = viewRange90k;
  const rangeWidth = viewEnd - viewStart;

  const time90kFromClientX = useCallback(
    (clientX: number): number | null => {
      const track = trackRef.current;
      if (!track) return null;
      const rect = track.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      return viewStart + Math.floor(ratio * rangeWidth);
    },
    [viewStart, rangeWidth],
  );

  const handleSeekAt = useCallback(
    (clientX: number) => {
      const time90k = time90kFromClientX(clientX);
      if (time90k === null) return;
      const rec = recordings.find(
        (r) => r.startTime90k <= time90k && time90k <= r.endTime90k,
      );
      if (rec) onSeek(rec, time90k);
    },
    [time90kFromClientX, recordings, onSeek],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    handleSeekAt(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    handleSeekAt(e.clientX);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Hour marks within the view range
  const hourMarks: number[] = [];
  const oneHour90k = 60 * 60 * 90000;
  const firstHour = Math.ceil(viewStart / oneHour90k) * oneHour90k;
  for (let t = firstHour; t < viewEnd; t += oneHour90k) {
    hourMarks.push(t);
  }

  const toPercent = (time90k: number) =>
    ((time90k - viewStart) / rangeWidth) * 100;

  const playheadPct =
    currentTime90k !== null ? toPercent(currentTime90k) : null;

  return (
    <Box sx={{ bgcolor: "#131313", px: 1, pb: 1 }}>
      {/* Track area */}
      <Box
        ref={trackRef}
        sx={{
          position: "relative",
          height: 60,
          bgcolor: "#1c1b1b",
          borderRadius: "4px",
          cursor: "crosshair",
          userSelect: "none",
          overflow: "hidden",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Recording segments */}
        {recordings.map((rec) => {
          const left = Math.max(0, toPercent(rec.startTime90k));
          const right = Math.min(100, toPercent(rec.endTime90k));
          const width = right - left;
          if (width <= 0) return null;
          const isActive = rec === activeRecording;
          return (
            <Box
              key={`${rec.startId}-${rec.endId ?? rec.startId}`}
              sx={{
                position: "absolute",
                top: "20%",
                height: "60%",
                left: `${left}%`,
                width: `${width}%`,
                bgcolor: isActive ? "#ff5722" : "#ff572240",
                borderRadius: "2px",
                pointerEvents: "none",
              }}
            />
          );
        })}

        {/* Playhead */}
        {playheadPct !== null && playheadPct >= 0 && playheadPct <= 100 && (
          <>
            {/* Label */}
            <Box
              sx={{
                position: "absolute",
                top: 2,
                left: `${playheadPct}%`,
                transform: "translateX(-50%)",
                pointerEvents: "none",
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "9px",
                  color: "#86cfff",
                  whiteSpace: "nowrap",
                }}
              >
                {currentTime90k !== null
                  ? `${formatHHMMSS(currentTime90k, timeZoneName)} (Hiện tại)`
                  : ""}
              </Typography>
            </Box>
            {/* Line */}
            <Box
              sx={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${playheadPct}%`,
                width: 1,
                bgcolor: "#86cfff",
                pointerEvents: "none",
              }}
            />
          </>
        )}
      </Box>

      {/* Hour labels + zoom controls */}
      <Box sx={{ position: "relative", height: 20, mt: 0.5 }}>
        {hourMarks.map((t) => {
          const pct = toPercent(t);
          if (pct < 0 || pct > 100) return null;
          return (
            <Typography
              key={t}
              variant="caption"
              sx={{
                position: "absolute",
                left: `${pct}%`,
                transform: "translateX(-50%)",
                fontSize: "9px",
                color: "text.secondary",
                whiteSpace: "nowrap",
              }}
            >
              {formatHHMM(t, timeZoneName)}
            </Typography>
          );
        })}

        {/* Zoom controls */}
        <Box sx={{ position: "absolute", right: 0, top: -4, display: "flex", gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => onZoom(Math.min(3, zoomLevel + 1) as ZoomLevel)}
            disabled={zoomLevel >= 3}
            sx={{ p: 0.25 }}
          >
            <ZoomOutIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onZoom(Math.max(0, zoomLevel - 1) as ZoomLevel)}
            disabled={zoomLevel <= 0}
            sx={{ p: 0.25 }}
          >
            <ZoomInIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

export { ZOOM_WINDOWS_90K };
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management
git add ui/src/Archive/TimelineScrubber.tsx
git commit -m "feat(archive): add TimelineScrubber component"
```

---

## Task 5: TopBar

**Files:**
- Create: `ui/src/Archive/TopBar.tsx`

- [ ] **Step 1: Write the component**

```tsx
// ui/src/Archive/TopBar.tsx
import React from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import GridViewIcon from "@mui/icons-material/GridView";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { Camera } from "../types";

interface Props {
  cameras: Camera[];
  selectedCamera: Camera | null;
  onSelectCamera: (camera: Camera) => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  currentTime90k: number | null;
  timeZoneName: string;
}

export default function TopBar({
  cameras,
  selectedCamera,
  onSelectCamera,
  selectedDate,
  onSelectDate,
  currentTime90k,
  timeZoneName,
}: Props) {
  const timeStr =
    currentTime90k !== null
      ? format(toZonedTime(new Date(currentTime90k / 90), timeZoneName), "HH:mm")
      : "--:--";

  return (
    <Box
      sx={{
        height: 64,
        px: 2,
        display: "flex",
        alignItems: "center",
        gap: 2,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "#1c1b1b",
        flexShrink: 0,
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, mr: 1 }}>
        Xem lại bản ghi
      </Typography>

      {/* Date picker */}
      <DatePicker
        value={selectedDate}
        onChange={(d) => d && onSelectDate(d)}
        format="dd-MM-yyyy"
        slotProps={{
          textField: {
            size: "small",
            sx: { width: 160 },
          },
        }}
      />

      {/* Time display */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <AccessTimeIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography
          variant="body2"
          sx={{ fontFamily: "'JetBrains Mono', monospace", minWidth: 40 }}
        >
          {timeStr}
        </Typography>
      </Box>

      {/* Camera chips */}
      <Box sx={{ display: "flex", gap: 1, flex: 1, flexWrap: "wrap" }}>
        {cameras.map((cam, idx) => {
          const label = `CAM ${String(idx + 1).padStart(2, "0")}`;
          const active = cam === selectedCamera;
          return (
            <Chip
              key={cam.uuid}
              label={label}
              size="small"
              onClick={() => onSelectCamera(cam)}
              sx={{
                bgcolor: active ? "#ff5722" : "transparent",
                color: active ? "#fff" : "text.secondary",
                border: active ? "none" : "1px solid",
                borderColor: active ? "transparent" : "#4b423b",
                "&:hover": {
                  bgcolor: active ? "#e64a19" : "#ffffff14",
                },
              }}
            />
          );
        })}
      </Box>

      {/* Grid icon placeholder */}
      <IconButton size="small">
        <GridViewIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Box>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management
git add ui/src/Archive/TopBar.tsx
git commit -m "feat(archive): add TopBar component"
```

---

## Task 6: ArchiveActivity (index.tsx) + Integration Tests

**Files:**
- Create: `ui/src/Archive/index.tsx`
- Create: `ui/src/Archive/Archive.test.tsx`

- [ ] **Step 1: Write the failing test first**

```tsx
// ui/src/Archive/Archive.test.tsx
import { screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterAll, afterEach, expect, test, vi } from "vitest";
import ArchiveActivity from "./index";
import { renderWithCtx } from "../testutil";
import type { Camera } from "../types";
import type * as apiTypes from "../api";

// Suppress jsdom HTMLMediaElement errors
Object.defineProperty(HTMLMediaElement.prototype, "load", {
  configurable: true,
  value: vi.fn(),
});
Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
});

const NOW_MS = 1_748_880_000_000; // 2026-01-01 00:00:00 UTC approx
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
      minStartTime90k: NOW_90K - 60 * 60 * 90000,
      maxEndTime90k: NOW_90K,
      totalDuration90k: 60 * 60 * 90000,
      totalSampleFileBytes: 25_000_000,
      fsBytes: 25_000_000,
      days: {},
      record: true,
    },
  },
};

const VSE_1 = { width: 1920, height: 1080, aspectWidth: 16, aspectHeight: 9 };

const REC_1: apiTypes.Recording = {
  startId: 101,
  openId: 1,
  runStartId: 100,
  startTime90k: NOW_90K - 2 * 60 * 60 * 90000,
  endTime90k: NOW_90K - 60 * 60 * 90000,
  videoSampleEntryId: 1,
  videoSamples: 3600 * 30,
  sampleFileBytes: 30_000_000,
};

const REC_2: apiTypes.Recording = {
  startId: 102,
  openId: 1,
  runStartId: 102,
  startTime90k: NOW_90K - 60 * 60 * 90000,
  endTime90k: NOW_90K,
  videoSampleEntryId: 1,
  videoSamples: 3600 * 30,
  sampleFileBytes: 20_000_000,
};

const FAKE_TOPLEVEL: apiTypes.ToplevelResponse = {
  timeZoneName: "UTC",
  cameras: [CAMERA_A, CAMERA_B],
  permissions: { adminUsers: true, readCameraConfigs: true, updateSignals: true, viewVideo: true },
};

const FAKE_FRAME = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockRecordingsA() {
  server.use(
    http.get(`/api/cameras/${CAMERA_A.uuid}/main/recordings`, () =>
      HttpResponse.json({
        recordings: [REC_2, REC_1],
        videoSampleEntries: { 1: VSE_1 },
      })
    )
  );
}

function mockRecordingsEmpty(cameraUuid: string) {
  server.use(
    http.get(`/api/cameras/${cameraUuid}/main/recordings`, () =>
      HttpResponse.json({ recordings: [], videoSampleEntries: {} })
    )
  );
}

test("renders camera chips from toplevel", async () => {
  mockRecordingsA();
  mockRecordingsEmpty(CAMERA_B.uuid);

  renderWithCtx(
    <ArchiveActivity Frame={FAKE_FRAME} toplevel={FAKE_TOPLEVEL} timeZoneName="UTC" />
  );

  expect(await screen.findByText("CAM 01")).toBeInTheDocument();
  expect(screen.getByText("CAM 02")).toBeInTheDocument();
});

test("fetches recordings on mount and shows time ranges", async () => {
  mockRecordingsA();

  renderWithCtx(
    <ArchiveActivity Frame={FAKE_FRAME} toplevel={{ ...FAKE_TOPLEVEL, cameras: [CAMERA_A] }} timeZoneName="UTC" />
  );

  // Wait for two recording rows to appear (time range HH:mm - HH:mm)
  await screen.findByText("2 đoạn phim");
});

test("selecting a camera chip refetches recordings", async () => {
  const user = userEvent.setup();

  let camBCalled = false;
  server.use(
    http.get(`/api/cameras/${CAMERA_A.uuid}/main/recordings`, () =>
      HttpResponse.json({ recordings: [REC_1], videoSampleEntries: { 1: VSE_1 } })
    ),
    http.get(`/api/cameras/${CAMERA_B.uuid}/main/recordings`, () => {
      camBCalled = true;
      return HttpResponse.json({ recordings: [], videoSampleEntries: {} });
    })
  );

  renderWithCtx(
    <ArchiveActivity Frame={FAKE_FRAME} toplevel={FAKE_TOPLEVEL} timeZoneName="UTC" />
  );

  await screen.findByText("CAM 01");

  await user.click(screen.getByText("CAM 02"));

  await waitFor(() => expect(camBCalled).toBe(true));
});

test("clicking a recording row sets video src", async () => {
  const user = userEvent.setup();
  mockRecordingsA();

  renderWithCtx(
    <ArchiveActivity Frame={FAKE_FRAME} toplevel={{ ...FAKE_TOPLEVEL, cameras: [CAMERA_A] }} timeZoneName="UTC" />
  );

  // Wait for recordings to load: find a recording row by its label
  await screen.findByText("2 đoạn phim");

  // Click the first recording row ("Bản ghi hệ thống" labels)
  const rows = screen.getAllByText("Bản ghi hệ thống");
  await user.click(rows[0]);

  // Video element should have its src set
  const video = document.querySelector("video") as HTMLVideoElement;
  expect(video).not.toBeNull();
  expect(video.src).toContain("/api/cameras/");
  expect(video.src).toContain("view.mp4");
});

test("export button disabled when no active recording", async () => {
  mockRecordingsA();

  renderWithCtx(
    <ArchiveActivity Frame={FAKE_FRAME} toplevel={{ ...FAKE_TOPLEVEL, cameras: [CAMERA_A] }} timeZoneName="UTC" />
  );

  await screen.findByText("2 đoạn phim");

  const exportBtn = screen.getByText("Thiết lập xuất dữ liệu");
  expect(exportBtn.closest("button")).toBeDisabled();
});

test("export dialog opens after clicking export CTA", async () => {
  const user = userEvent.setup();
  mockRecordingsA();

  renderWithCtx(
    <ArchiveActivity Frame={FAKE_FRAME} toplevel={{ ...FAKE_TOPLEVEL, cameras: [CAMERA_A] }} timeZoneName="UTC" />
  );

  await screen.findByText("2 đoạn phim");

  // First click a recording to make export button active
  const rows = screen.getAllByText("Bản ghi hệ thống");
  await user.click(rows[0]);

  // Now export button is enabled
  const exportBtn = screen.getByText("Thiết lập xuất dữ liệu");
  expect(exportBtn.closest("button")).not.toBeDisabled();

  // Click it
  await user.click(exportBtn);

  // Dialog appears with camera name
  expect(await screen.findByText("Xuất đoạn phim")).toBeInTheDocument();
  expect(screen.getByText(/Front Door/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx vitest run src/Archive/Archive.test.tsx 2>&1 | tail -20
```

Expected: FAIL – `./index` module not found.

- [ ] **Step 3: Write the ArchiveActivity**

```tsx
// ui/src/Archive/index.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import * as api from "../api";
import type { FrameProps } from "../App";
import type { Camera } from "../types";
import { combine, CombinedRecording } from "../List/VideoList";
import { toZonedTime } from "date-fns-tz";
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

export default function ArchiveActivity({ Frame, toplevel, timeZoneName }: Props) {
  const cameras = toplevel.cameras;

  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(
    cameras.length > 0 ? cameras[0] : null,
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [recordings, setRecordings] = useState<CombinedRecording[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [activeRecording, setActiveRecording] = useState<CombinedRecording | null>(null);
  const [currentTime90k, setCurrentTime90k] = useState<number | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(0);

  // Fetch recordings whenever camera or date changes
  useEffect(() => {
    if (!selectedCamera) return;

    const abort = new AbortController();
    setLoadingRecordings(true);

    const doFetch = async () => {
      // Day boundaries in server timezone
      const startOfDay = toZonedTime(selectedDate, timeZoneName);
      startOfDay.setHours(0, 0, 0, 0);
      const startOf90k = Math.floor(startOfDay.getTime() * 90);
      const endOf90k = startOf90k + 24 * 60 * 60 * 90000;

      const resp = await api.recordings(
        {
          cameraUuid: selectedCamera.uuid,
          stream: "main",
          startTime90k: startOf90k,
          endTime90k: endOf90k,
        },
        { signal: abort.signal },
      );

      if (resp.status === "aborted") return;

      setLoadingRecordings(false);

      if (resp.status === "success") {
        // Sort descending so index 0 = most recent
        resp.response.recordings.sort((a, b) => b.startId - a.startId);
        setRecordings(combine(undefined, resp.response));
      } else {
        setRecordings([]);
      }
    };

    doFetch();

    return () => {
      abort.abort();
      setLoadingRecordings(false);
    };
  }, [selectedCamera, selectedDate, timeZoneName]);

  // Compute viewRange90k centered on current playhead (or full day)
  const viewRange90k = useMemo((): [number, number] => {
    const windowSize = ZOOM_WINDOWS_90K[zoomLevel];
    if (currentTime90k !== null) {
      const half = windowSize / 2;
      return [currentTime90k - half, currentTime90k + half];
    }
    // Full day centered on noon
    if (recordings.length > 0) {
      const mid = Math.floor(
        (recordings[recordings.length - 1].startTime90k + recordings[0].endTime90k) / 2,
      );
      return [mid - windowSize / 2, mid + windowSize / 2];
    }
    // Fallback: today's 24h window
    const startOfDay = toZonedTime(selectedDate, timeZoneName);
    startOfDay.setHours(0, 0, 0, 0);
    const start90k = Math.floor(startOfDay.getTime() * 90);
    return [start90k, start90k + 24 * 60 * 60 * 90000];
  }, [currentTime90k, zoomLevel, recordings, selectedDate, timeZoneName]);

  const handleSelectRecording = useCallback(
    (recording: CombinedRecording, seekTime90k?: number) => {
      setActiveRecording(recording);
      if (seekTime90k !== undefined) {
        setCurrentTime90k(seekTime90k);
      }
    },
    [],
  );

  const handleSeek = useCallback((recording: CombinedRecording, time90k: number) => {
    setActiveRecording(recording);
    setCurrentTime90k(time90k);
  }, []);

  const handleRecordingEnd = useCallback(() => {
    if (!activeRecording) return;
    const idx = recordings.indexOf(activeRecording);
    // recordings are descending by time; "next" in playback = higher index (earlier time)
    if (idx >= 0 && idx < recordings.length - 1) {
      setActiveRecording(recordings[idx + 1]);
    }
  }, [recordings, activeRecording]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Frame>
        <Box sx={{ display: "flex", height: "100%", overflow: "hidden" }}>
          {/* Main column */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <TopBar
              cameras={cameras}
              selectedCamera={selectedCamera}
              onSelectCamera={setSelectedCamera}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              currentTime90k={currentTime90k}
              timeZoneName={timeZoneName}
            />
            <VideoPlayer
              activeRecording={activeRecording}
              camera={selectedCamera}
              currentTime90k={currentTime90k}
              timeZoneName={timeZoneName}
              onTimeUpdate={setCurrentTime90k}
              onRecordingEnd={handleRecordingEnd}
            />
            <TimelineScrubber
              recordings={recordings}
              activeRecording={activeRecording}
              currentTime90k={currentTime90k}
              viewRange90k={viewRange90k}
              timeZoneName={timeZoneName}
              onSeek={handleSeek}
              onZoom={setZoomLevel}
              zoomLevel={zoomLevel}
            />
          </Box>

          {/* Right panel */}
          <RecordingList
            recordings={recordings}
            activeRecording={activeRecording}
            camera={selectedCamera}
            loading={loadingRecordings}
            timeZoneName={timeZoneName}
            onSelect={handleSelectRecording}
            onExport={() => setExportDialogOpen(true)}
          />
        </Box>

        <ExportDialog
          open={exportDialogOpen}
          recording={activeRecording}
          camera={selectedCamera}
          timeZoneName={timeZoneName}
          onClose={() => setExportDialogOpen(false)}
        />
      </Frame>
    </LocalizationProvider>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx vitest run src/Archive/Archive.test.tsx 2>&1 | tail -20
```

Expected: 6/6 PASS

If a test fails, diagnose and fix. Common issues:
- `ToplevelResponse` missing fields → add them to `FAKE_TOPLEVEL`
- MUI `LocalizationProvider` missing in test → `renderWithCtx` wraps in ThemeProvider but not LocalizationProvider; the component wraps itself so this should be fine
- `HTMLMediaElement` not settable → use `Object.defineProperty` (already in test setup)
- `camera: null as any` in stream back-reference → the component reads `camera.shortName` but gets `Camera` from parent props, not from stream; should be fine

- [ ] **Step 5: Run full test suite**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx vitest run 2>&1 | tail -20
```

Expected: All existing tests still pass.

- [ ] **Step 6: Run TypeScript check**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx tsc --noEmit 2>&1 | head -40
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management
git add ui/src/Archive/index.tsx ui/src/Archive/Archive.test.tsx
git commit -m "feat(archive): add ArchiveActivity with integration tests"
```

---

## Task 7: App.tsx Routing Wiring

**Files:**
- Modify: `ui/src/App.tsx`

- [ ] **Step 1: Update App.tsx**

In `ui/src/App.tsx`, replace the `/archive` route that uses `ListActivity` with `ArchiveActivity`.

Add the import at the top (after the existing imports):
```tsx
import ArchiveActivity from "./Archive";
```

Change the route element from:
```tsx
<Route
  path="archive"
  element={
    <ListActivity
      toplevel={toplevel}
      timeZoneName={timeZoneName!}
      Frame={Frame}
    />
  }
/>
```

To:
```tsx
<Route
  path="archive"
  element={
    <ArchiveActivity
      toplevel={toplevel}
      timeZoneName={timeZoneName!}
      Frame={Frame}
    />
  }
/>
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors. (The `ListActivity` import remains since other places may use it — but if it becomes unused, TypeScript will warn. Remove the import too if that's the case.)

- [ ] **Step 3: Run full test suite**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management/ui
npx vitest run 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
cd /home/ai/dev/moonfire-nvr/.claude/worktrees/stitch-shell-camera-management
git add ui/src/App.tsx
git commit -m "feat(archive): wire /archive route to new ArchiveActivity"
```

---

## Self-Review

**Spec coverage check:**
- [x] 3-column layout: sidebar (AppShell) | main (TopBar+VideoPlayer+Timeline) | RecordingList 300px — Task 6 `index.tsx`
- [x] Video player with custom controls ⏮⏪⏸/▶⏩⏭ — Task 3 `VideoPlayer.tsx`
- [x] Timeline scrubber: segment rects, playhead, click/drag seek — Task 4 `TimelineScrubber.tsx`
- [x] 4 zoom levels (1h/4h/8h/24h) — Task 4 `ZOOM_WINDOWS_90K`
- [x] TopBar: DatePicker (DD-MM-YYYY), time display, camera chips — Task 5 `TopBar.tsx`
- [x] RecordingList: rows with `HH:mm - HH:mm`, active row highlight, `{n} đoạn phim` — Task 2
- [x] Export button disabled when no active recording — Task 2 + Test 5
- [x] ExportDialog: trim HH:mm:ss inputs, timestamp checkbox, download button — Task 1
- [x] Download via `window.open(api.recordingUrl(...))` — Task 1 `handleDownload`
- [x] Fetch full day range in server timezone — Task 6 `startOf90k` calculation
- [x] Always use "main" stream — all API calls use `"main"`
- [x] `combine(undefined, resp.response)` — Task 6
- [x] App.tsx wiring — Task 7
- [x] All 6 integration test scenarios — Task 6 test file

**Placeholder scan:** No TBDs, TODOs, or incomplete steps found.

**Type consistency:**
- `CombinedRecording` imported from `../List/VideoList` throughout — consistent
- `ZoomLevel = 0 | 1 | 2 | 3` defined in `TimelineScrubber.tsx`, imported in `index.tsx` — consistent
- `api.recordingUrl(camera.uuid, "main", recording, timestampTrack, [trimStart, trimEnd])` — matches `api.ts:456` signature
- `FrameProps` imported from `../App` in `index.tsx` — consistent with how other activities use it
