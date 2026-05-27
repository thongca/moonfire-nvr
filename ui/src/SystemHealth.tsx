// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import * as api from "./api";
import { FrameProps } from "./App";
import { formatBytes, formatCount } from "./format";

interface Props {
  toplevel: api.ToplevelResponse;
  Frame: React.ComponentType<FrameProps>;
}

export default function SystemHealthActivity({ toplevel, Frame }: Props) {
  const streams = toplevel.cameras.flatMap((camera) =>
    Object.values(camera.streams).filter((stream) => stream !== undefined),
  );
  const activeStreams = streams.filter((stream) => stream.record).length;
  const retainedSeconds = Math.round(
    streams.reduce((total, stream) => total + stream.totalDuration90k, 0) / 90_000,
  );
  const storageBytes = streams.reduce((total, stream) => total + stream.fsBytes, 0);
  const fullAdmin =
    toplevel.permissions.adminUsers &&
    toplevel.permissions.readCameraConfigs &&
    toplevel.permissions.updateSignals &&
    toplevel.permissions.viewVideo;

  return (
    <Frame>
      <Container sx={{ py: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          System Health
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2">
                  Runtime
                </Typography>
                <Typography>{toplevel.timeZoneName}</Typography>
                <Typography>{toplevel.user?.name ?? "No active user"}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2">
                  Recording
                </Typography>
                <Typography>{formatCount(toplevel.cameras.length, "camera configured", "cameras configured")}</Typography>
                <Typography>{formatCount(activeStreams, "recording stream active", "recording streams active")}</Typography>
                <Typography>{formatCount(retainedSeconds, "second retained", "seconds retained")}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2">
                  Storage
                </Typography>
                <Typography>{formatBytes(storageBytes)} on disk</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2">
                  Operator capabilities
                </Typography>
                <Typography>
                  {fullAdmin ? "Full administration enabled" : "Limited administration"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Frame>
  );
}
