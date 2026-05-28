// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link } from "react-router";
import * as api from "./api";
import { FrameProps } from "./App";
import { formatBytes, formatCount } from "./format";
import { shellTokens } from "./theme";

interface Props {
  toplevel: api.ToplevelResponse;
  Frame: React.ComponentType<FrameProps>;
}

type Camera = api.ToplevelResponse["cameras"][number];
type Stream = NonNullable<Camera["streams"][keyof Camera["streams"]]>;

export interface DashboardStats {
  cameras: api.ToplevelResponse["cameras"];
  streams: Stream[];
  activeStreams: number;
  storageBytes: number;
  sampleBytes: number;
  recordingLoadPercent: number;
}

export interface CameraHealth {
  camera: Camera;
  streams: Stream[];
  activeStreams: number;
  status: "recording" | "idle";
}

interface ActivityDay {
  date: string;
  duration90k: number;
}

export const getStreams = (camera: Camera): Stream[] =>
  Object.values(camera.streams).filter((stream): stream is Stream =>
    stream !== undefined,
  );

export const getCameraHealth = (camera: Camera): CameraHealth => {
  const streams = getStreams(camera);
  const activeStreams = streams.filter((stream) => stream.record).length;

  return {
    camera,
    streams,
    activeStreams,
    status: activeStreams > 0 ? "recording" : "idle",
  };
};

const getRecentFrameCount = (streams: Stream[]) =>
  streams.reduce((total, stream) => total + (stream.numRecentFrames ?? 0), 0);

const getRecentRecordingCount = (streams: Stream[]) =>
  streams.reduce(
    (total, stream) => total + (stream.numRecentRecordings ?? 0),
    0,
  );

const getActivityDays = (streams: Stream[]): ActivityDay[] => {
  const days = new Map<string, number>();
  for (const stream of streams) {
    for (const [date, day] of Object.entries(stream.days)) {
      days.set(date, (days.get(date) ?? 0) + day.totalDuration90k);
    }
  }
  return [...days.entries()]
    .map(([date, duration90k]) => ({ date, duration90k }))
    .filter((day) => day.duration90k > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const getDashboardStats = (
  toplevel: api.ToplevelResponse,
): DashboardStats => {
  const streams = toplevel.cameras.flatMap(getStreams);
  const activeStreams = streams.filter((stream) => stream.record).length;

  return {
    cameras: toplevel.cameras,
    streams,
    activeStreams,
    storageBytes: streams.reduce((total, stream) => total + stream.fsBytes, 0),
    sampleBytes: streams.reduce(
      (total, stream) => total + stream.totalSampleFileBytes,
      0,
    ),
    recordingLoadPercent:
      streams.length === 0
        ? 0
        : Math.round((activeStreams / streams.length) * 100),
  };
};

function MetricCard({
  title,
  value,
  detail,
  accent = false,
}: {
  title: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <Card
      component="article"
      sx={{
        height: "100%",
        border: `1px solid ${
          accent ? shellTokens.primary.fireOrange : shellTokens.border.subtle
        }`,
        background: shellTokens.surface.raised,
      }}
    >
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h3" component="p" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
        <Typography color="text.secondary">{detail}</Typography>
      </CardContent>
    </Card>
  );
}

function CameraFeedCard({ health }: { health: CameraHealth }) {
  const recentFrames = getRecentFrameCount(health.streams);
  const recentRecordings = getRecentRecordingCount(health.streams);
  const hasRecentRecording = recentFrames > 0 || recentRecordings > 0;

  return (
    <Card
      data-testid={`feed-card-${health.camera.uuid}`}
      sx={{
        minHeight: 220,
        border: `1px solid ${shellTokens.border.subtle}`,
        background: `linear-gradient(180deg, ${shellTokens.surface.overlay}, ${shellTokens.surface.panel})`,
      }}
    >
      <CardContent
        sx={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 2 }}
        >
          <Chip
            size="small"
            label={health.status === "recording" ? "REC" : "IDLE"}
            color={health.status === "recording" ? "primary" : "default"}
          />
          <Typography variant="caption" color="text.secondary">
            {formatCount(
              health.activeStreams,
              "recording stream",
              "recording streams",
            )}
          </Typography>
        </Stack>
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px dashed ${shellTokens.border.subtle}`,
            borderRadius: 1,
            mb: 2,
          }}
        >
          {hasRecentRecording ? (
            <Stack spacing={0.5} sx={{ textAlign: "center" }}>
              <Typography sx={{ fontWeight: 700 }}>Recording active</Typography>
              <Typography variant="body2" color="text.secondary">
                {formatCount(recentFrames, "recent frame", "recent frames")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatBytes(
                  health.streams.reduce(
                    (total, stream) => total + (stream.recentFrameBytes ?? 0),
                    0,
                  ),
                )} buffered
              </Typography>
            </Stack>
          ) : (
            <Typography color="text.secondary">No recent recording</Typography>
          )}
        </Box>
        <Typography variant="h6" component="h3">
          {health.camera.shortName}
        </Typography>
        <Typography color="text.secondary">{health.camera.description}</Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button component={Link} to="/archive" size="small">
            Open Archive
          </Button>
          <Button component={Link} to="/cameras" size="small">
            Manage Camera
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function PriorityFeeds({ cameraHealth }: { cameraHealth: CameraHealth[] }) {
  return (
    <Box>
      <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 700 }}>
        Priority Feeds
      </Typography>
      {cameraHealth.length === 0 ? (
        <Card sx={{ border: `1px solid ${shellTokens.border.subtle}` }}>
          <CardContent>
            <Typography variant="h6">No cameras configured</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Add cameras to populate priority feeds.
            </Typography>
            <Button component={Link} to="/cameras" variant="contained">
              Manage Cameras
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={1.5}>
          {cameraHealth.map((health) => (
            <Grid key={health.camera.uuid} size={{ xs: 12, md: 6 }}>
              <CameraFeedCard health={health} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

function QuickManagement({ cameraHealth }: { cameraHealth: CameraHealth[] }) {
  return (
    <Card
      data-testid="quick-management"
      sx={{ border: `1px solid ${shellTokens.border.subtle}`, height: "100%" }}
    >
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 700 }}>
          Quick Management
        </Typography>
        <Stack spacing={1.5}>
          {cameraHealth.length === 0 ? (
            <Typography color="text.secondary">No cameras configured</Typography>
          ) : (
            cameraHealth.map((health) => (
              <Box
                key={health.camera.uuid}
                sx={{
                  border: `1px solid ${shellTokens.border.subtle}`,
                  borderRadius: 1,
                  p: 1.5,
                }}
              >
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>
                      {health.camera.shortName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {health.activeStreams} active / {health.streams.length} streams
                    </Typography>
                    <Button
                      component={Link}
                      to="/cameras"
                      size="small"
                      sx={{ mt: 1, px: 0 }}
                    >
                      Manage Camera
                    </Button>
                  </Box>
                  <Chip
                    size="small"
                    label={health.status === "recording" ? "Recording" : "Idle"}
                    color={health.status === "recording" ? "primary" : "default"}
                  />
                </Stack>
              </Box>
            ))
          )}
        </Stack>
        <Button
          component={Link}
          to="/cameras"
          fullWidth
          sx={{ mt: 2 }}
          variant="outlined"
        >
          Manage All
        </Button>
      </CardContent>
    </Card>
  );
}

function ActivityReport({ streams }: { streams: Stream[] }) {
  const activityDays = getActivityDays(streams);

  return (
    <Card sx={{ border: `1px solid ${shellTokens.border.subtle}` }}>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 1, fontWeight: 700 }}>
          24h Activity Report
        </Typography>
        {activityDays.length === 0 ? (
          <>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Recording activity history not available yet
            </Typography>
            <Box
              sx={{
                alignItems: "center",
                border: `1px dashed ${shellTokens.border.subtle}`,
                borderRadius: 1,
                display: "flex",
                height: 96,
                justifyContent: "center",
                px: 2,
                textAlign: "center",
              }}
            >
              <Typography color="text.secondary">
                No 24h recording history available
              </Typography>
            </Box>
          </>
        ) : (
          <Stack spacing={1.5} data-testid="activity-history-bars">
            <Typography color="text.secondary">
              {formatCount(
                activityDays.length,
                "day with recording activity",
                "days with recording activity",
              )}
            </Typography>
            {activityDays.map((day) => (
              <Box key={day.date}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {day.date}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {Math.round(day.duration90k / 90_000)} sec recorded
                  </Typography>
                </Stack>
                <Box
                  sx={{
                    bgcolor: "rgba(255, 87, 34, 0.18)",
                    border: `1px solid ${shellTokens.border.subtle}`,
                    borderRadius: 1,
                    height: 12,
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: shellTokens.primary.fireOrange,
                      height: "100%",
                      width: `${Math.max(4, Math.min(100, (day.duration90k / (24 * 60 * 60 * 90_000)) * 100))}%`,
                    }}
                  />
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardActivity({ toplevel, Frame }: Props) {
  const stats = getDashboardStats(toplevel);
  const cameraHealth = stats.cameras.map(getCameraHealth);
  let liveSync = "unavailable";

  try {
    liveSync = new Intl.DateTimeFormat("en-US", {
      timeZone: toplevel.timeZoneName,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    }).format(new Date());
  } catch {
    liveSync = `${new Date().toISOString().slice(11, 19)} UTC`;
  }

  return (
    <Frame>
      <Container maxWidth={false} sx={{ py: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 800 }}>
              System Overview
            </Typography>
            <Typography color="text.secondary">
              Infrastructure monitoring and recording telemetry
            </Typography>
          </Box>
          <Chip
            label={`Live Sync: ${liveSync}`}
            variant="outlined"
            sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
          />
        </Stack>

        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              title="Cameras"
              value={`${stats.cameras.length}`}
              detail={`${stats.activeStreams} / ${stats.streams.length} recording`}
              accent
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              title="Recording Load"
              value={`${stats.recordingLoadPercent}%`}
              detail={`${stats.activeStreams} / ${stats.streams.length} recording`}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              title="Storage Used"
              value={formatBytes(stats.storageBytes)}
              detail={`${formatBytes(stats.sampleBytes)} recorded samples`}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              title="Activity Status"
              value="No active signals"
              detail="Signal telemetry unavailable"
            />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <PriorityFeeds cameraHealth={cameraHealth} />
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <QuickManagement cameraHealth={cameraHealth} />
          </Grid>
          <Grid size={{ xs: 12, lg: 8 }}>
            <ActivityReport streams={stats.streams} />
          </Grid>
        </Grid>
      </Container>
    </Frame>
  );
}
