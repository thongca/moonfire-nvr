// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { Link } from "react-router";
import * as api from "./api";
import { FrameProps } from "./App";

interface Props {
  toplevel: api.ToplevelResponse;
  Frame: React.ComponentType<FrameProps>;
}

const formatCount = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

const formatBytes = (bytes: number) => {
  if (bytes < 1000) return `${bytes} bytes`;
  return `${(bytes / 1000).toFixed(1)} KB`;
};

export default function DashboardActivity({ toplevel, Frame }: Props) {
  const streams = toplevel.cameras.flatMap((camera) =>
    Object.values(camera.streams).filter((stream) => stream !== undefined),
  );
  const activeStreams = streams.filter((stream) => stream.record).length;
  const retainedSeconds = Math.round(
    streams.reduce((total, stream) => total + stream.totalDuration90k, 0) / 90_000,
  );
  const storageBytes = streams.reduce((total, stream) => total + stream.fsBytes, 0);
  const sampleBytes = streams.reduce(
    (total, stream) => total + stream.totalSampleFileBytes,
    0,
  );

  const coverage = [
    "Playback and export",
    "Camera configuration",
    "Stream recording control",
    "User and permission administration",
    "Live monitoring",
    "System storage health",
  ];

  const cards = [
    {
      title: "Archive",
      body: "Search recordings, play video, scrub the timeline, and export clips.",
      action: "Open Archive",
      to: "/archive",
    },
    {
      title: "Cameras",
      body: "Manage camera definitions, credentials, and recording streams.",
      action: "Manage Cameras",
      to: "/cameras",
    },
    {
      title: "Users",
      body: "Manage accounts and review granted permissions.",
      action: "Manage Users",
      to: "/users",
    },
    {
      title: "Signal Controls",
      body: "Review recording signal status for every camera stream.",
      action: "Open Signal Controls",
      to: "/signals",
    },
    {
      title: "System Health",
      body: "Review runtime, permissions, recording retention, and storage usage.",
      action: "Open System Health",
      to: "/system",
    },
    {
      title: "Live View",
      body: "Open the live camera view for real-time monitoring.",
      action: "Open Live View",
      to: "/live",
    },
  ];

  return (
    <Frame>
      <Container sx={{ py: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          NVR Management
        </Typography>
        <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
          <Typography>{formatCount(toplevel.cameras.length, "camera configured", "cameras configured")}</Typography>
          <Typography>{formatCount(activeStreams, "recording stream active", "recording streams active")}</Typography>
        </Box>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2">
                  Recording retention
                </Typography>
                <Typography>{formatCount(retainedSeconds, "second retained", "seconds retained")}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2">
                  Storage used
                </Typography>
                <Typography>{formatBytes(storageBytes)} on disk</Typography>
                <Typography color="text.secondary">
                  {formatBytes(sampleBytes)} recorded samples
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2">
                  Management coverage
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {coverage.map((item) => (
                    <Typography key={item}>{item}</Typography>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        <Grid container spacing={2}>
          {cards.map((card) => (
            <Grid key={card.title} size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" component="h2">
                    {card.title}
                  </Typography>
                  <Typography color="text.secondary">{card.body}</Typography>
                </CardContent>
                <CardActions>
                  <Button component={Link} to={card.to}>
                    {card.action}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Frame>
  );
}
