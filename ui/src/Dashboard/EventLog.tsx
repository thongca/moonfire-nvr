// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { shellTokens } from "../theme";

interface EventRow {
  type: string;
  badgeColor: string;
  camera: string;
  timeAgo: string;
}

const EVENTS: EventRow[] = [
  {
    type: "MOTION",
    badgeColor: "#f59e0b",
    camera: "CAM-04: Loading Dock A",
    timeAgo: "Just Now",
  },
  {
    type: "PERSON",
    badgeColor: "#86cfff",
    camera: "CAM-12: Main Entrance",
    timeAgo: "-2m",
  },
  {
    type: "VEHICLE",
    badgeColor: "#2dd4bf",
    camera: "CAM-22: Perimeter North",
    timeAgo: "-15m",
  },
  {
    type: "MOTION",
    badgeColor: "#f59e0b",
    camera: "CAM-08: Server Room 1",
    timeAgo: "-42m",
  },
];

function TypeBadge({ label, color }: { label: string; color: string }) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        bgcolor: color + "26", // ~15% opacity background
        border: `1px solid ${color}`,
        color: color,
        fontSize: "0.6rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        px: 0.75,
        py: 0.25,
        borderRadius: 0.5,
        whiteSpace: "nowrap",
        minWidth: 58,
        justifyContent: "center",
      }}
    >
      {label}
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

function EventRow({ event }: { event: EventRow }) {
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
      <TypeBadge label={event.type} color={event.badgeColor} />
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
        {event.camera}
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
        {event.timeAgo}
      </Typography>
    </Box>
  );
}

export default function EventLog() {
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
      {/* Header row */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1.5,
        }}
      >
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{ color: shellTokens.text.primary }}
        >
          Event Log
        </Typography>
        {/* LIVE badge */}
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

      {/* Event rows */}
      <Box sx={{ flex: 1 }}>
        {EVENTS.map((evt, i) => (
          <EventRow key={i} event={evt} />
        ))}
      </Box>

      {/* Footer link */}
      <Box sx={{ mt: 1.5, textAlign: "right" }}>
        <Typography
          variant="caption"
          sx={{
            color: shellTokens.primary.fireOrange,
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          VIEW FULL LOG
        </Typography>
      </Box>
    </Paper>
  );
}
