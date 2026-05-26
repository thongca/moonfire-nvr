// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import WarningAmberOutlined from "@mui/icons-material/WarningAmberOutlined";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";
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
