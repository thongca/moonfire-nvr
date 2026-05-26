// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

/**
 * @fileoverview Shared primitive components used by both the Cameras page and
 * the Settings/CameraConfig section.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/** Monospace chip for displaying an IP address. */
export function IpChip({ ip }: { ip: string }) {
  if (ip === "—")
    return (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    );
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 1,
        py: 0.25,
        borderRadius: 0.5,
        bgcolor: "rgba(134, 207, 255, 0.1)",
        border: "1px solid rgba(134, 207, 255, 0.25)",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "0.75rem",
        color: "#86cfff",
        letterSpacing: "0.02em",
      }}
    >
      {ip}
    </Box>
  );
}

/** Small coloured dot indicating whether a camera is online or offline. */
export function StatusDot({ online }: { online: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        bgcolor: online ? "#35d07f" : "#ff5c5c",
        flexShrink: 0,
      }}
    />
  );
}
