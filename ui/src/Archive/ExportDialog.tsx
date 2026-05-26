// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import * as api from "../api";
import { Camera, StreamType } from "../types";
import { CombinedRecording } from "../List/VideoList";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

interface Props {
  open: boolean;
  recording: CombinedRecording | null;
  camera: Camera | null;
  /** The stream type for the recording being exported. */
  streamType: StreamType;
  timeZoneName: string;
  onClose: () => void;
}

/**
 * Formats a 90k timestamp as HH:mm:ss in the given timezone.
 */
function formatTime90k(time90k: number, tz: string): string {
  return format(toZonedTime(new Date(time90k / 90), tz), "HH:mm:ss");
}

/**
 * Parses an "HH:mm:ss" string into 90k ticks, using the date portion
 * of referenceDate (in the given timezone) as the calendar day.
 * Returns null if the string is invalid.
 */
function parseHHMMSS(
  s: string,
  referenceDate: Date,
  tz: string,
): number | null {
  const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const sec = parseInt(m[3]);
  if (h > 23 || min > 59 || sec > 59) return null;
  const base = toZonedTime(referenceDate, tz);
  base.setHours(h, min, sec, 0);
  return Math.floor(base.getTime() * 90); // ms * 90 = 90k ticks
}

/**
 * Dialog for exporting (downloading) a segment of a recording.
 */
export default function ExportDialog({
  open,
  recording,
  camera,
  streamType,
  timeZoneName,
  onClose,
}: Props): React.JSX.Element | null {
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [timestampTrack, setTimestampTrack] = useState(false);

  // Reset inputs whenever the recording changes.
  useEffect(() => {
    if (recording == null) return;
    setStartInput(formatTime90k(recording.startTime90k, timeZoneName));
    setEndInput(formatTime90k(recording.endTime90k, timeZoneName));
    setTimestampTrack(false);
  }, [recording, timeZoneName]);

  if (recording == null || camera == null) return null;

  const referenceDate = new Date(recording.startTime90k / 90);

  const trimStart90k = parseHHMMSS(startInput, referenceDate, timeZoneName);
  const trimEnd90k = parseHHMMSS(endInput, referenceDate, timeZoneName);

  const downloadDisabled =
    trimStart90k == null ||
    trimEnd90k == null ||
    trimStart90k >= trimEnd90k ||
    trimStart90k < recording.startTime90k ||
    trimEnd90k > recording.endTime90k;

  const handleDownload = () => {
    if (trimStart90k == null || trimEnd90k == null) return;
    const url = api.recordingUrl(
      camera.uuid,
      streamType,
      recording,
      timestampTrack,
      [trimStart90k, trimEnd90k],
    );
    window.open(url, "_blank");
  };

  const startFormatted = formatTime90k(recording.startTime90k, timeZoneName);
  const endFormatted = formatTime90k(recording.endTime90k, timeZoneName);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Xuất đoạn phim</DialogTitle>
      <DialogContent>
        <Typography variant="body2" gutterBottom>
          {camera.shortName} &middot; {startFormatted} &ndash; {endFormatted}
        </Typography>
        <TextField
          label="Thời điểm bắt đầu (HH:mm:ss)"
          value={startInput}
          onChange={(e) => setStartInput(e.target.value)}
          fullWidth
          margin="normal"
          size="small"
          error={trimStart90k == null}
          helperText={trimStart90k == null ? "Định dạng không hợp lệ" : undefined}
        />
        <TextField
          label="Thời điểm kết thúc (HH:mm:ss)"
          value={endInput}
          onChange={(e) => setEndInput(e.target.value)}
          fullWidth
          margin="normal"
          size="small"
          error={trimEnd90k == null}
          helperText={trimEnd90k == null ? "Định dạng không hợp lệ" : undefined}
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button
          variant="contained"
          onClick={handleDownload}
          disabled={downloadDisabled}
        >
          Tải xuống
        </Button>
      </DialogActions>
    </Dialog>
  );
}
