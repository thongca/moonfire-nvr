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
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import MemoryOutlinedIcon from "@mui/icons-material/MemoryOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import SensorsOutlinedIcon from "@mui/icons-material/SensorsOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { useEffect, useState } from "react";
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

const monoFont = '"JetBrains Mono", "Roboto Mono", Consolas, monospace';

const panelSx = {
  border: `1px solid ${shellTokens.border.subtle}`,
  borderRadius: "4px",
  background: shellTokens.surface.panel,
  boxShadow: "none",
};

const labelSx = {
  color: "text.secondary",
  fontFamily: monoFont,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  lineHeight: "14px",
  textTransform: "uppercase",
};

export const getStreams = (camera: Camera): Stream[] =>
  Object.values(camera.streams).filter(
    (stream): stream is Stream => stream !== undefined,
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

export const formatRate = (bytesPerSec?: number | null): string => {
  if (bytesPerSec === undefined || bytesPerSec === null) {
    return "unavailable";
  }
  return `${formatBytes(bytesPerSec)}/s`;
};

export const getProcessMemoryValue = (
  telemetry: api.ProcessTelemetryResponse | null,
  unavailable: boolean,
): string => {
  if (unavailable || telemetry?.memory.status === "unavailable") {
    return "Unavailable";
  }
  if (telemetry === null) {
    return "Pending";
  }
  return formatBytes(telemetry.memory.residentBytes);
};

export const getProcessIoValue = (
  telemetry: api.ProcessTelemetryResponse | null,
  unavailable: boolean,
): string => {
  if (unavailable || telemetry?.io.status === "unavailable") {
    return "Unavailable";
  }
  if (telemetry === null) {
    return "Pending";
  }
  return `${formatRate(telemetry.io.writeBytesPerSec)} write`;
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
  footer,
  icon,
  accent = false,
}: {
  title: string;
  value: string;
  detail: string;
  footer?: React.ReactNode;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card
      component="article"
      sx={{
        ...panelSx,
        height: 132,
        border: `1px solid ${
          accent ? shellTokens.primary.fireOrange : shellTokens.border.subtle
        }`,
        background: `linear-gradient(180deg, ${shellTokens.surface.raised}, ${shellTokens.surface.panel})`,
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Typography sx={labelSx}>{title}</Typography>
          <Box sx={{ color: "text.secondary", opacity: 0.75 }}>{icon}</Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mt: 1 }}>
          <Typography
            component="p"
            noWrap
            sx={{
              fontSize: value.length > 12 ? 25 : 34,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              minWidth: 0,
            }}
          >
            {value}
          </Typography>
          <Typography
            sx={{ color: "text.secondary", fontFamily: monoFont, fontSize: 11 }}
          >
            {detail}
          </Typography>
        </Stack>
        {footer}
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
        ...panelSx,
        minHeight: 186,
        border: `1px solid ${shellTokens.border.subtle}`,
        background: shellTokens.surface.panel,
      }}
    >
      <CardContent
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          p: 1.25,
          "&:last-child": { pb: 1.25 },
        }}
      >
        <Box
          sx={{
            minHeight: 112,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${shellTokens.border.subtle}`,
            borderRadius: "3px",
            mb: 1,
            position: "relative",
            overflow: "hidden",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.05), transparent 40%), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 26px), #101010",
          }}
        >
          <Chip
            size="small"
            label={health.status === "recording" ? "REC" : "IDLE"}
            color={health.status === "recording" ? "primary" : "default"}
            sx={{
              position: "absolute",
              left: 8,
              top: 8,
              height: 20,
              borderRadius: "2px",
              fontFamily: monoFont,
              fontSize: 10,
            }}
          />
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
                )}{" "}
                buffered
              </Typography>
            </Stack>
          ) : (
            <Typography
              sx={{
                color: "text.secondary",
                fontFamily: monoFont,
                fontSize: 12,
              }}
            >
              No recent recording
            </Typography>
          )}
        </Box>
        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 800 }}>
          {health.camera.shortName}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: 12 }}>
          {health.camera.description || "No description"}
        </Typography>
        <Typography
          sx={{
            color: "text.secondary",
            fontFamily: monoFont,
            fontSize: 11,
            mt: 0.5,
          }}
        >
          {formatCount(
            health.activeStreams,
            "recording stream",
            "recording streams",
          )}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button
            aria-label={`Open archive for ${health.camera.shortName}`}
            component={Link}
            to="/archive"
            size="small"
          >
            Open Archive
          </Button>
          <Button
            aria-label={`Manage ${health.camera.shortName} from priority feed`}
            component={Link}
            to="/cameras"
            size="small"
          >
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
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 1 }}
      >
        <Typography
          variant="h5"
          component="h2"
          sx={{ fontSize: 18, fontWeight: 800 }}
        >
          Priority Feeds
        </Typography>
        <Typography sx={labelSx}>Configure</Typography>
      </Stack>
      {cameraHealth.length === 0 ? (
        <Card sx={{ ...panelSx, minHeight: 170 }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 800 }}>
              No cameras configured
            </Typography>
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
    <Card data-testid="quick-management" sx={{ ...panelSx, height: "100%" }}>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <SettingsOutlinedIcon color="primary" fontSize="small" />
          <Typography
            variant="h5"
            component="h2"
            sx={{ fontSize: 16, fontWeight: 800 }}
          >
            Quick Management
          </Typography>
        </Stack>
        <Stack spacing={1.5}>
          {cameraHealth.length === 0 ? (
            <Typography color="text.secondary">
              No cameras configured
            </Typography>
          ) : (
            cameraHealth.map((health) => (
              <Box
                key={health.camera.uuid}
                sx={{
                  border: `1px solid ${shellTokens.border.subtle}`,
                  borderRadius: "3px",
                  p: 1,
                  background: shellTokens.surface.raised,
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 13 }}>
                      {health.camera.shortName}
                    </Typography>
                    <Typography
                      sx={{
                        color: "text.secondary",
                        fontFamily: monoFont,
                        fontSize: 11,
                      }}
                    >
                      {health.activeStreams} active / {health.streams.length}{" "}
                      streams
                    </Typography>
                    <Button
                      aria-label={`Manage ${health.camera.shortName} from quick management`}
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
                    color={
                      health.status === "recording" ? "primary" : "default"
                    }
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
    <Card sx={panelSx}>
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Typography
          variant="h5"
          component="h2"
          sx={{ mb: 1, fontSize: 18, fontWeight: 800 }}
        >
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
                borderRadius: "3px",
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
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{ mb: 0.5 }}
                >
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
  const [processTelemetry, setProcessTelemetry] =
    useState<api.ProcessTelemetryResponse | null>(null);
  const [processTelemetryUnavailable, setProcessTelemetryUnavailable] =
    useState(false);
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

  useEffect(() => {
    let currentController: AbortController | null = null;
    let mounted = true;
    let requestId = 0;
    const fetchTelemetry = async () => {
      currentController?.abort();
      const controller = new AbortController();
      const thisRequestId = ++requestId;
      currentController = controller;
      try {
        const result = await api.processTelemetry({
          signal: controller.signal,
        });
        if (!mounted || thisRequestId !== requestId) {
          return;
        }
        if (result.status === "success") {
          setProcessTelemetry(result.response);
          setProcessTelemetryUnavailable(false);
        } else if (result.status !== "aborted") {
          setProcessTelemetry(null);
          setProcessTelemetryUnavailable(true);
        }
      } catch (e) {
        if (
          mounted &&
          thisRequestId === requestId &&
          !controller.signal.aborted
        ) {
          setProcessTelemetry(null);
          setProcessTelemetryUnavailable(true);
          console.error("process telemetry request failed", e);
        }
      } finally {
        if (currentController === controller) {
          currentController = null;
        }
      }
    };

    void fetchTelemetry();
    const interval = window.setInterval(() => void fetchTelemetry(), 10_000);

    return () => {
      mounted = false;
      currentController?.abort();
      window.clearInterval(interval);
    };
  }, []);

  const processMemoryValue = getProcessMemoryValue(
    processTelemetry,
    processTelemetryUnavailable,
  );
  const processIoValue = getProcessIoValue(
    processTelemetry,
    processTelemetryUnavailable,
  );
  const networkStatus =
    processTelemetryUnavailable ||
    processTelemetry?.network.status === "unavailable"
      ? "Network telemetry unavailable"
      : "Network telemetry pending";

  return (
    <Frame>
      <Container maxWidth={false} sx={{ py: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography
              variant="h3"
              component="h1"
              sx={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em" }}
            >
              System Overview
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 13 }}>
              Infrastructure monitoring and recording telemetry
            </Typography>
          </Box>
          <Chip
            label={`Live Sync: ${liveSync}`}
            variant="outlined"
            sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
          />
        </Stack>

        <Grid container spacing={1} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              title="Cameras"
              value={`${stats.cameras.length}`}
              detail="active"
              icon={<VideocamOutlinedIcon fontSize="small" />}
              footer={
                <Typography
                  sx={{
                    ...labelSx,
                    mt: 0.5,
                    color: shellTokens.primary.fireOrange,
                  }}
                >
                  {stats.activeStreams} of {stats.streams.length} recording
                </Typography>
              }
              accent
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              title="Recording Load"
              value={`${stats.recordingLoadPercent}%`}
              detail="rec load"
              icon={<MemoryOutlinedIcon fontSize="small" />}
              footer={
                <>
                  <LinearProgress
                    variant="determinate"
                    value={stats.recordingLoadPercent}
                    sx={{ mt: 1.25, height: 4, borderRadius: 0 }}
                  />
                  <Typography sx={{ ...labelSx, mt: 0.5 }}>
                    {stats.activeStreams} / {stats.streams.length} recording
                  </Typography>
                </>
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              title="Storage Used"
              value={formatBytes(stats.storageBytes)}
              detail="on disk"
              icon={<StorageOutlinedIcon fontSize="small" />}
              footer={
                <Typography sx={{ ...labelSx, mt: 0.5 }}>
                  {formatBytes(stats.sampleBytes)} recorded samples
                </Typography>
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              title="Process Memory"
              value={processMemoryValue}
              detail={
                processTelemetry?.memory.status === "available"
                  ? "resident"
                  : ""
              }
              icon={<MemoryOutlinedIcon fontSize="small" />}
              footer={
                <Typography sx={{ ...labelSx, mt: 0.5 }}>
                  {processTelemetryUnavailable
                    ? "Process telemetry unavailable"
                    : processTelemetry?.memory.status === "available"
                      ? `${formatBytes(processTelemetry.memory.virtualBytes)} virtual`
                      : processTelemetry?.memory.status === "unavailable"
                        ? "Process telemetry unavailable"
                        : "Process telemetry pending"}
                </Typography>
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              title="Recorder I/O"
              value={processIoValue}
              detail=""
              icon={<SensorsOutlinedIcon fontSize="small" />}
              footer={
                <Typography sx={{ ...labelSx, mt: 0.5 }}>
                  {networkStatus}
                </Typography>
              }
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
