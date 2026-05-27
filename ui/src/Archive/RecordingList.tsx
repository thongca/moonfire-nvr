// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import React from "react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Camera } from "../types";
import { CombinedRecording } from "../List/VideoList";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

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
  const totalSec = Math.floor(
    (rec.endTime90k - rec.startTime90k) / 90000,
  );
  const minutes = Math.floor(totalSec / 60);
  const seconds = String(totalSec % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function recordingKey(rec: CombinedRecording): string {
  return `${rec.startId}-${rec.endId ?? rec.startId}`;
}

/**
 * Right-panel recording list for the Archive page.
 * Displays the day's recordings for a single camera in a scrollable list
 * with a sticky header and footer.
 */
export default function RecordingList({
  recordings,
  activeRecording,
  camera,
  loading,
  timeZoneName,
  onSelect,
  onExport,
}: Props): React.JSX.Element {
  return (
    <Box
      sx={{
        width: 300,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: "#1c1b1b",
        borderLeft: "1px solid #4b423b",
        height: "100%",
        overflow: "hidden",
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
          borderBottom: "1px solid #4b423b",
          flexShrink: 0,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
          Danh sách bản ghi
        </Typography>
        {loading && <CircularProgress size={16} />}
      </Box>

      {/* Scrollable recording rows */}
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {recordings.map((rec) => {
          const isActive =
            activeRecording !== null &&
            recordingKey(rec) === recordingKey(activeRecording);
          const startHHMM = formatHHMM(rec.startTime90k, timeZoneName);
          const endHHMM = formatHHMM(rec.endTime90k, timeZoneName);
          const duration = formatDuration(rec);

          return (
            <Box
              key={recordingKey(rec)}
              onClick={() => onSelect(rec)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 1.5,
                py: 1,
                cursor: "pointer",
                bgcolor: isActive ? "#ff572215" : "transparent",
                borderLeft: isActive
                  ? "2px solid #ff5722"
                  : "2px solid transparent",
                "&:hover": {
                  bgcolor: isActive ? "#ff572220" : "#ffffff08",
                },
              }}
            >
              {/* Thumbnail placeholder with duration badge */}
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
                    color: "#ffffff",
                    fontSize: "9px",
                    lineHeight: 1,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {duration}
                </Typography>
              </Box>

              {/* Text content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "12px",
                    color: isActive ? "#ff5722" : "text.primary",
                    lineHeight: 1.3,
                  }}
                >
                  {startHHMM} - {endHHMM}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    color: "text.secondary",
                    fontSize: "11px",
                    lineHeight: 1.3,
                  }}
                >
                  Bản ghi hệ thống
                </Typography>
                {camera !== null && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      color: "text.secondary",
                      fontSize: "11px",
                      lineHeight: 1.3,
                    }}
                  >
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
          px: 1.5,
          py: 1.5,
          borderTop: "1px solid #4b423b",
          display: "flex",
          flexDirection: "column",
          gap: 1,
          flexShrink: 0,
        }}
      >
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {recordings.length} đoạn phim
        </Typography>
        <Button
          variant="contained"
          size="small"
          fullWidth
          disabled={activeRecording === null}
          onClick={onExport}
        >
          Thiết lập xuất dữ liệu
        </Button>
      </Box>
    </Box>
  );
}
