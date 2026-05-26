// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import { shellTokens } from "../theme";

function VolumeCard({
  label,
  pct,
  color,
  used,
  free,
}: {
  label: string;
  pct: number;
  color: string;
  used: string;
  free: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        bgcolor: shellTokens.surface.panel,
        borderColor: shellTokens.border.subtle,
        flex: "1 1 280px",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <StorageOutlinedIcon
          fontSize="small"
          sx={{ color: shellTokens.text.secondary }}
        />
        <Typography variant="body2" fontWeight={600}>
          {label}
        </Typography>
        <Box
          component="span"
          sx={{
            ml: 0.5,
            px: 0.75,
            py: 0.125,
            borderRadius: 0.5,
            fontSize: "0.6rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: pct >= 80 ? "#ff5c5c" : "#86cfff",
            bgcolor:
              pct >= 80 ? "rgba(255,92,92,0.12)" : "rgba(134,207,255,0.12)",
          }}
        >
          {pct}% USED
        </Box>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: shellTokens.surface.table,
          "& .MuiLinearProgress-bar": { bgcolor: color },
          mb: 1.5,
        }}
      />
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="body2" color="text.secondary">
          Used: {used}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Free: {free}
        </Typography>
      </Box>
    </Paper>
  );
}

export default function StorageManagement() {
  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={600}>
        Storage Management
      </Typography>
      <Typography variant="h6" fontWeight={500}>
        Storage Overview
      </Typography>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <VolumeCard
          label="Volume 1 (Main Array)"
          pct={82}
          color={shellTokens.primary.fireOrange}
          used="14.2 TB"
          free="3.8 TB"
        />
        <VolumeCard
          label="Volume 2 (Archive)"
          pct={45}
          color="#019ad8"
          used="8.1 TB"
          free="9.9 TB"
        />
      </Box>
    </Stack>
  );
}
