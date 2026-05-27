import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import React, { useCallback, useRef } from "react";

import { CombinedRecording } from "../List/VideoList";

export type ZoomLevel = 0 | 1 | 2 | 3;

// Zoom level → visible window size in 90k ticks
export const ZOOM_WINDOWS_90K = [
  1 * 60 * 60 * 90000, // level 0: 1h
  4 * 60 * 60 * 90000, // level 1: 4h
  8 * 60 * 60 * 90000, // level 2: 8h
  24 * 60 * 60 * 90000, // level 3: 24h
] as const;

const ONE_HOUR_90K = 60 * 60 * 90000;

interface Props {
  recordings: CombinedRecording[];
  activeRecording: CombinedRecording | null;
  currentTime90k: number | null;
  viewRange90k: [number, number]; // [start, end] visible window
  timeZoneName: string;
  onSeek: (recording: CombinedRecording, time90k: number) => void;
  onZoom: (level: ZoomLevel) => void;
  zoomLevel: ZoomLevel;
}

function TimelineScrubber({
  recordings,
  activeRecording,
  currentTime90k,
  viewRange90k,
  timeZoneName,
  onSeek,
  onZoom,
  zoomLevel,
}: Props) {
  const [viewStart, viewEnd] = viewRange90k;
  const viewDuration = viewEnd - viewStart;
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<boolean>(false);

  const toPercent = useCallback(
    (time90k: number) => ((time90k - viewStart) / viewDuration) * 100,
    [viewStart, viewDuration]
  );

  const seek = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const time90k =
        viewStart + ((clientX - rect.left) / rect.width) * viewDuration;
      const rec = recordings.find(
        (r) => r.startTime90k <= time90k && time90k <= r.endTime90k
      );
      if (rec) {
        onSeek(rec, time90k);
      }
    },
    [viewStart, viewDuration, recordings, onSeek]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      seek(e.clientX);
    },
    [seek]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;
      seek(e.clientX);
    },
    [seek]
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Compute hour marks within view range
  const hourMarks: number[] = [];
  const firstHour = Math.ceil(viewStart / ONE_HOUR_90K) * ONE_HOUR_90K;
  for (let t = firstHour; t <= viewEnd; t += ONE_HOUR_90K) {
    const pct = toPercent(t);
    if (pct >= 0 && pct <= 100) {
      hourMarks.push(t);
    }
  }

  // Playhead visibility
  const showPlayhead =
    currentTime90k !== null &&
    currentTime90k >= viewStart &&
    currentTime90k <= viewEnd;
  const playheadPct = showPlayhead ? toPercent(currentTime90k!) : 0;

  return (
    <Box sx={{ bgcolor: "#131313", px: 1, pb: 1 }}>
      {/* Track area */}
      <Box
        ref={trackRef}
        sx={{
          height: 60,
          bgcolor: "#1c1b1b",
          borderRadius: "4px",
          cursor: "crosshair",
          userSelect: "none",
          overflow: "hidden",
          position: "relative",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Recording segments */}
        {recordings.map((rec) => {
          const left = toPercent(rec.startTime90k);
          const right = toPercent(rec.endTime90k);
          const width = right - left;
          if (left >= 100 || right <= 0 || width <= 0) return null;
          return (
            <Box
              key={`${rec.startId}-${rec.endId ?? rec.startId}`}
              sx={{
                position: "absolute",
                left: `${left}%`,
                width: `${width}%`,
                top: "20%",
                height: "60%",
                borderRadius: "2px",
                bgcolor:
                  activeRecording === rec ? "#ff5722" : "#ff572240",
              }}
            />
          );
        })}

        {/* Playhead */}
        {showPlayhead && (
          <>
            {/* Label */}
            <Typography
              sx={{
                position: "absolute",
                left: `${playheadPct}%`,
                top: 2,
                transform: "translateX(-50%)",
                fontSize: "9px",
                color: "#86cfff",
                fontFamily: "JetBrains Mono, monospace",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              {format(
                toZonedTime(new Date(currentTime90k! / 90), timeZoneName),
                "HH:mm:ss"
              )}{" "}
              (Hiện tại)
            </Typography>
            {/* Vertical line */}
            <Box
              sx={{
                position: "absolute",
                left: `${playheadPct}%`,
                top: 0,
                width: "1px",
                height: "100%",
                bgcolor: "#86cfff",
                pointerEvents: "none",
              }}
            />
          </>
        )}
      </Box>

      {/* Below track: hour marks + zoom controls */}
      <Box sx={{ position: "relative", height: "20px", mt: 0.25 }}>
        {/* Hour marks */}
        {hourMarks.map((t) => (
          <Typography
            key={t}
            sx={{
              position: "absolute",
              left: `${toPercent(t)}%`,
              transform: "translateX(-50%)",
              fontSize: "9px",
              color: "text.secondary",
              userSelect: "none",
              lineHeight: "20px",
            }}
          >
            {format(
              toZonedTime(new Date(t / 90), timeZoneName),
              "HH:mm"
            )}
          </Typography>
        ))}

        {/* Zoom controls */}
        <Box
          sx={{
            position: "absolute",
            right: 0,
            top: -4,
            display: "flex",
            alignItems: "center",
          }}
        >
          <IconButton
            size="small"
            sx={{ p: 0.25 }}
            onClick={() =>
              onZoom(Math.min(3, zoomLevel + 1) as ZoomLevel)
            }
            disabled={zoomLevel >= 3}
          >
            <ZoomOutIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            sx={{ p: 0.25 }}
            onClick={() =>
              onZoom(Math.max(0, zoomLevel - 1) as ZoomLevel)
            }
            disabled={zoomLevel <= 0}
          >
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

export default TimelineScrubber;
