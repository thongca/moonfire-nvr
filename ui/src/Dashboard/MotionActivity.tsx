// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { shellTokens } from "../theme";

const COLOR_LOW = "#86cfff";
const COLOR_MED = "#f59e0b";
const COLOR_HIGH = "#ff5c5c";

const CHART_HEIGHT = 80;

/** [low%, med%, high%] for each bucket */
const BUCKETS: [number, number, number][] = [
  [10, 5, 0],
  [15, 8, 2],
  [30, 20, 5],
  [45, 35, 12],
  [25, 15, 3],
  [60, 40, 18],
];

const TIME_LABELS = ["00:00", "06:00", "12:00", "18:00", "Now"];

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: color,
          flexShrink: 0,
        }}
      />
      <Typography
        variant="caption"
        sx={{
          color: shellTokens.text.secondary,
          fontSize: "0.65rem",
          fontWeight: 600,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export default function MotionActivity() {
  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 3,
        p: 2,
        bgcolor: shellTokens.surface.panel,
        borderColor: shellTokens.border.subtle,
        borderRadius: `${shellTokens.radius.base}px`,
      }}
    >
      {/* Header row */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{ color: shellTokens.text.primary }}
        >
          Motion Activity (24h)
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <LegendDot color={COLOR_LOW} label="Low" />
          <LegendDot color={COLOR_MED} label="Med" />
          <LegendDot color={COLOR_HIGH} label="High" />
        </Box>
      </Box>

      {/* Bar chart area */}
      <Box sx={{ position: "relative" }}>
        {/* Bars */}
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-end",
            gap: "6px",
            height: CHART_HEIGHT,
          }}
        >
          {BUCKETS.map(([low, med, high], i) => {
            const total = low + med + high;
            const lowH = total > 0 ? (low / total) * CHART_HEIGHT : 0;
            const medH = total > 0 ? (med / total) * CHART_HEIGHT : 0;
            const highH = total > 0 ? (high / total) * CHART_HEIGHT : 0;
            return (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  height: CHART_HEIGHT,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                }}
              >
                {high > 0 && (
                  <Box
                    sx={{
                      width: "100%",
                      height: highH,
                      bgcolor: COLOR_HIGH,
                      borderRadius: "2px 2px 0 0",
                    }}
                  />
                )}
                {med > 0 && (
                  <Box
                    sx={{
                      width: "100%",
                      height: medH,
                      bgcolor: COLOR_MED,
                    }}
                  />
                )}
                {low > 0 && (
                  <Box
                    sx={{
                      width: "100%",
                      height: lowH,
                      bgcolor: COLOR_LOW,
                      borderRadius: high === 0 && med === 0 ? "2px 2px 0 0" : 0,
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>

        {/* Time axis labels spread evenly below */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            mt: 0.75,
          }}
        >
          {TIME_LABELS.map((label) => (
            <Typography
              key={label}
              variant="caption"
              sx={{
                color: shellTokens.text.secondary,
                fontSize: "0.6rem",
                fontFamily: "monospace",
              }}
            >
              {label}
            </Typography>
          ))}
        </Box>
      </Box>
    </Paper>
  );
}
