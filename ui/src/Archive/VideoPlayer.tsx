// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import React, { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import FastForwardIcon from "@mui/icons-material/FastForward";
import FastRewindIcon from "@mui/icons-material/FastRewind";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import SkipPreviousIcon from "@mui/icons-material/SkipPrevious";
import * as api from "../api";
import { Camera } from "../types";
import { CombinedRecording } from "../List/VideoList";

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
}: Props): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(true);

  // When activeRecording changes, load and play the new recording.
  useEffect(() => {
    const video = videoRef.current;
    if (video === null || activeRecording === null || camera === null) {
      return;
    }
    video.src = api.recordingUrl(
      camera.uuid,
      "main",
      activeRecording,
      false,
    );
    video.load();
    video.play().catch(() => {
      // Silently ignore play() rejections (e.g., autoplay policy).
    });
  }, [activeRecording, camera]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video === null || activeRecording === null) return;
    const time90k =
      activeRecording.startTime90k + Math.floor(video.currentTime * 90000);
    onTimeUpdate(time90k);
  };

  const handleEnded = () => {
    onRecordingEnd();
  };

  const handlePlay = () => setPaused(false);
  const handlePause = () => setPaused(true);

  // Custom control handlers
  const handleSkipPrevious = () => {
    const video = videoRef.current;
    if (video === null) return;
    video.currentTime = 0;
  };

  const handleFastRewind = () => {
    const video = videoRef.current;
    if (video === null) return;
    video.currentTime = Math.max(0, video.currentTime - 10);
  };

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (video === null) return;
    if (paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const handleFastForward = () => {
    const video = videoRef.current;
    if (video === null) return;
    video.currentTime += 10;
  };

  const handleSkipNext = () => {
    const video = videoRef.current;
    if (video === null || activeRecording === null) return;
    video.currentTime =
      (activeRecording.endTime90k - activeRecording.startTime90k) / 90000;
    onRecordingEnd();
  };

  const formattedTime =
    currentTime90k !== null
      ? format(
          toZonedTime(new Date(currentTime90k / 90), timeZoneName),
          "HH:mm:ss",
        )
      : null;

  const disabled = activeRecording === null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {/* Video area with 16:9 aspect ratio */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          bgcolor: "#000",
          overflow: "hidden",
        }}
      >
        {/* Empty state */}
        {activeRecording === null && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "#000",
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", userSelect: "none" }}
            >
              Chọn một bản ghi để phát
            </Typography>
          </Box>
        )}

        {/* Video element */}
        <video
          ref={videoRef}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: activeRecording !== null ? "block" : "none",
          }}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPlay={handlePlay}
          onPause={handlePause}
        />

        {/* Top-left overlay: camera name */}
        {activeRecording !== null && camera !== null && (
          <Box
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              bgcolor: "rgba(0, 0, 0, 0.55)",
              borderRadius: "12px",
              px: 1,
              py: 0.25,
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: "#fff", lineHeight: 1.4, fontSize: "11px" }}
            >
              {camera.shortName}
            </Typography>
          </Box>
        )}

        {/* Top-right overlay: time and resolution */}
        {activeRecording !== null && formattedTime !== null && (
          <Box
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              bgcolor: "rgba(0, 0, 0, 0.55)",
              borderRadius: "12px",
              px: 1,
              py: 0.25,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: "#fff",
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: 1.4,
                fontSize: "11px",
              }}
            >
              {formattedTime} | {activeRecording.height}p
            </Typography>
          </Box>
        )}
      </Box>

      {/* Custom controls row */}
      <Box
        sx={{
          height: 56,
          bgcolor: "#1c1b1b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
        }}
      >
        <IconButton
          size="small"
          disabled={disabled}
          onClick={handleSkipPrevious}
          aria-label="Skip to beginning"
          sx={{ color: disabled ? "action.disabled" : "text.primary" }}
        >
          <SkipPreviousIcon />
        </IconButton>
        <IconButton
          size="small"
          disabled={disabled}
          onClick={handleFastRewind}
          aria-label="Rewind 10 seconds"
          sx={{ color: disabled ? "action.disabled" : "text.primary" }}
        >
          <FastRewindIcon />
        </IconButton>
        <IconButton
          size="small"
          disabled={disabled}
          onClick={handlePlayPause}
          aria-label={paused ? "Play" : "Pause"}
          sx={{ color: disabled ? "action.disabled" : "text.primary" }}
        >
          {paused ? <PlayArrowIcon /> : <PauseIcon />}
        </IconButton>
        <IconButton
          size="small"
          disabled={disabled}
          onClick={handleFastForward}
          aria-label="Fast forward 10 seconds"
          sx={{ color: disabled ? "action.disabled" : "text.primary" }}
        >
          <FastForwardIcon />
        </IconButton>
        <IconButton
          size="small"
          disabled={disabled}
          onClick={handleSkipNext}
          aria-label="Skip to end"
          sx={{ color: disabled ? "action.disabled" : "text.primary" }}
        >
          <SkipNextIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
