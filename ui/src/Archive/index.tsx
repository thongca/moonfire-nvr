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

export default function ArchiveActivity({
  Frame,
  toplevel,
  timeZoneName,
}: Props): React.JSX.Element {
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(
    toplevel.cameras[0] ?? null,
  );
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [recordings, setRecordings] = useState<CombinedRecording[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [activeRecording, setActiveRecording] =
    useState<CombinedRecording | null>(null);
  const [currentTime90k, setCurrentTime90k] = useState<number | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(0);

  // Fetch recordings when camera, date, or timezone changes
  useEffect(() => {
    if (!selectedCamera) return;
    const abort = new AbortController();
    setLoadingRecordings(true);

    const doFetch = async () => {
      // Compute day boundaries in server timezone
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

  // Compute the visible timeline window
  const viewRange90k = useMemo((): [number, number] => {
    const windowSize = ZOOM_WINDOWS_90K[zoomLevel];
    if (currentTime90k !== null) {
      return [currentTime90k - windowSize / 2, currentTime90k + windowSize / 2];
    }
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
    const idx = recordings.findIndex(
      (r) =>
        r.startId === activeRecording.startId &&
        (r.endId ?? r.startId) === (activeRecording.endId ?? activeRecording.startId),
    );
    if (idx !== -1 && idx + 1 < recordings.length) {
      setActiveRecording(recordings[idx + 1]);
    }
  };

  const handleSeek = (recording: CombinedRecording, time90k: number) => {
    setActiveRecording(recording);
    setCurrentTime90k(time90k);
  };

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
              cameras={toplevel.cameras}
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
            onSelect={(rec) => setActiveRecording(rec)}
            onExport={() => setExportDialogOpen(true)}
          />
        </Box>
        <ExportDialog
          open={exportDialogOpen}
          recording={activeRecording}
          camera={selectedCamera}
          streamType="main"
          timeZoneName={timeZoneName}
          onClose={() => setExportDialogOpen(false)}
        />
      </Frame>
    </LocalizationProvider>
  );
}
