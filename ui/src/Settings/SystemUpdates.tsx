// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SystemUpdateOutlinedIcon from "@mui/icons-material/SystemUpdateOutlined";
import { shellTokens } from "../theme";

interface Props {
  serverVersion?: string;
}

export default function SystemUpdates({ serverVersion }: Props) {
  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={600}>
        System Updates
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          bgcolor: shellTokens.surface.panel,
          borderColor: shellTokens.border.subtle,
          maxWidth: 480,
        }}
      >
        <Stack spacing={2}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <SystemUpdateOutlinedIcon
              sx={{ color: shellTokens.text.secondary }}
            />
            <Box>
              <Typography
                sx={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: shellTokens.text.secondary,
                }}
              >
                Current Version
              </Typography>
              <Typography
                sx={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: shellTokens.text.primary,
                }}
              >
                {serverVersion ?? "—"}
              </Typography>
            </Box>
          </Box>
          <Button
            variant="outlined"
            sx={{
              alignSelf: "flex-start",
              borderColor: shellTokens.border.subtle,
              color: shellTokens.text.primary,
            }}
          >
            Check for Updates
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
