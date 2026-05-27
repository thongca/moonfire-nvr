// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { shellTokens } from "../theme";

/** Format a Date as HH:MM:SS UTC */
function formatUtcClock(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

/** Label-caps style shared by every card label */
const labelCapsSx = {
  fontSize: "0.65rem",
  fontWeight: 700,
  letterSpacing: "0.10em",
  textTransform: "uppercase" as const,
  color: shellTokens.text.secondary,
  lineHeight: 1.2,
} as const;

/** A single stat card */
function StatCard({ children }: { children: React.ReactNode }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        flex: 1,
        px: 2,
        py: 1.5,
        bgcolor: shellTokens.surface.panel,
        borderColor: shellTokens.border.subtle,
        borderRadius: `${shellTokens.radius.base}px`,
        minWidth: 0,
      }}
    >
      {children}
    </Paper>
  );
}

/** Red dot used for the offline indicator */
function RedDot() {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        bgcolor: "#ff5c5c",
        mr: 0.5,
        verticalAlign: "middle",
      }}
    />
  );
}

/** Green dot used for the live clock */
function GreenDot() {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        bgcolor: "#35d07f",
        mr: 0.75,
        verticalAlign: "middle",
      }}
    />
  );
}

export default function StatsBar() {
  const [clock, setClock] = useState(() => formatUtcClock(new Date()));

  useEffect(() => {
    const id = setInterval(() => setClock(formatUtcClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        width: "100%",
      }}
    >
      <Stack direction="row" spacing={2} sx={{ flex: 1, minWidth: 0 }}>
        {/* CAMERAS */}
        <StatCard>
          <Typography sx={labelCapsSx}>CAMERAS</Typography>
          <Typography
            variant="body1"
            fontWeight={700}
            sx={{ color: shellTokens.text.primary, mt: 0.25 }}
          >
            32 / 34 Active
          </Typography>
          <Typography variant="caption" sx={{ color: "#ff5c5c" }}>
            <RedDot />
            2 Offline
          </Typography>
        </StatCard>

        {/* COMPUTE LOAD */}
        <StatCard>
          <Typography sx={labelCapsSx}>COMPUTE LOAD</Typography>
          <Typography
            variant="body1"
            fontWeight={700}
            sx={{ color: shellTokens.text.primary, mt: 0.25 }}
          >
            64%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={64}
            sx={{
              mt: 0.75,
              height: 4,
              borderRadius: 2,
              bgcolor: shellTokens.surface.table,
              "& .MuiLinearProgress-bar": {
                bgcolor: shellTokens.primary.fireOrange,
              },
            }}
          />
        </StatCard>

        {/* STORAGE ARRAY */}
        <StatCard>
          <Typography sx={labelCapsSx}>STORAGE ARRAY</Typography>
          <Typography
            variant="body1"
            fontWeight={700}
            sx={{ color: shellTokens.text.primary, mt: 0.25 }}
          >
            14.2 TB Free
          </Typography>
          <Typography variant="caption" sx={{ color: shellTokens.text.secondary }}>
            ~4 Days Retention
          </Typography>
        </StatCard>

        {/* UNRESOLVED ALERTS */}
        <StatCard>
          <Typography sx={labelCapsSx}>UNRESOLVED ALERTS</Typography>
          <Typography
            variant="body1"
            fontWeight={700}
            sx={{ color: "warning.main", mt: 0.25 }}
          >
            12
          </Typography>
          <Typography variant="caption" sx={{ color: shellTokens.text.secondary }}>
            3 High Priority
          </Typography>
        </StatCard>
      </Stack>

      {/* Live UTC clock — top-right of the bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        <GreenDot />
        <Typography
          variant="caption"
          sx={{
            fontFamily: "monospace",
            color: "#35d07f",
            fontWeight: 600,
            letterSpacing: "0.05em",
          }}
        >
          {clock}
        </Typography>
      </Box>
    </Box>
  );
}
