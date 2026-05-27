// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import * as api from "./api";
import { FrameProps } from "./App";

interface Props {
  toplevel: api.ToplevelResponse;
  Frame: React.ComponentType<FrameProps>;
}

export default function SignalControlsActivity({ toplevel, Frame }: Props) {
  return (
    <Frame>
      <Container sx={{ py: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Signal Controls
        </Typography>
        <Typography sx={{ mb: 2 }}>
          {toplevel.permissions.updateSignals
            ? "Signal updates enabled"
            : "Signal updates disabled"}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {toplevel.cameras.map((camera) => (
            <Card key={camera.uuid}>
              <CardContent>
                <Typography variant="h6" component="h2">
                  {camera.shortName}
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                  {Object.entries(camera.streams).map(([type, stream]) => (
                    <Chip
                      key={type}
                      label={`${type.toUpperCase()} ${stream?.record ? "recording" : "disabled"}`}
                      color={stream?.record ? "primary" : "default"}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>
    </Frame>
  );
}
