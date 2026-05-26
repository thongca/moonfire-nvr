// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { shellTokens } from "../theme";

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: "0.625rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: shellTokens.text.secondary,
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderRadius: 1,
          border: `1px solid ${shellTokens.border.subtle}`,
          bgcolor: shellTokens.surface.raised,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "0.875rem",
          color: shellTokens.text.primary,
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

export default function Network() {
  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={600}>
        Network
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
          <ReadonlyField label="Bind Address" value="0.0.0.0" />
          <ReadonlyField label="Port" value="18081" />
          <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
            Network settings are configured in{" "}
            <code>moonfire-nvr.toml</code>.
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
