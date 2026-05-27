// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import React, { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import { useSnackbars } from "../snackbars";
import { FrameProps } from "../App";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import AddEditDialog from "./AddEditDialog";
import { IpChip } from "./CameraRowPrimitives";
import {
  cameraIp,
  cameraStatus,
  storageLabel,
  streamBadgeLabel,
} from "./viewModel";
import { shellTokens } from "../theme";

interface Props {
  Frame: React.ComponentType<FrameProps>;
  csrf?: string;
}

// Status dot + label matching Stitch design
function StatusCell({ status }: { status: ReturnType<typeof cameraStatus> }) {
  const color = status.color === "success" ? "#35d07f" : "#ff5c5c";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, whiteSpace: "nowrap" }}>
      <Box
        component="span"
        sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0 }}
      />
      <Typography variant="body2" sx={{ color }}>
        {status.label}
      </Typography>
    </Box>
  );
}

// Stream badge matching Stitch orange-solid / muted styles
function StreamBadge({ stream, offline }: { stream: api.StreamAdminEntry; offline: boolean }) {
  const label = streamBadgeLabel(stream);
  const isRecord = stream.mode === "record";
  if (!isRecord) return null;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 0.75,
        py: 0.25,
        borderRadius: 0.5,
        fontSize: "0.65rem",
        fontWeight: 700,
        letterSpacing: "0.06em",
        ...(offline
          ? {
              bgcolor: shellTokens.surface.table,
              color: shellTokens.text.secondary,
              border: `1px solid ${shellTokens.border.subtle}`,
            }
          : {
              bgcolor: shellTokens.primary.fireOrange,
              color: "#ffffff",
            }),
      }}
    >
      {label}
    </Box>
  );
}

export default function CamerasActivity({ Frame, csrf }: Props) {
  const [cameras, setCameras] = useState<api.CameraAdminEntry[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<api.CameraAdminEntry | null>(null);
  const snackbars = useSnackbars();

  const fetchCameras = useCallback(async () => {
    const resp = await api.getCamerasAdmin({});
    if (resp.status === "success") {
      setCameras(resp.response.cameras);
    } else if (resp.status === "error") {
      snackbars.enqueue({ message: "Failed to load cameras: " + resp.message });
    }
  }, [snackbars]);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  const handleDelete = async (camera: api.CameraAdminEntry) => {
    if (!window.confirm(`Delete camera "${camera.shortName}"?`)) return;
    const resp = await api.deleteCamera(camera.id, csrf, {});
    if (resp.status === "success" || resp.status === "aborted") {
      fetchCameras();
    } else {
      snackbars.enqueue({ message: "Delete failed: " + resp.message });
    }
  };

  const handleSaved = () => {
    setDialogOpen(false);
    setEditTarget(null);
    fetchCameras();
  };

  return (
    <Frame>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={3}>
          {/* Page header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight={700}>
                Camera Management
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Configure and manage connected IP cameras
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { setEditTarget(null); setDialogOpen(true); }}
              sx={{ bgcolor: shellTokens.primary.fireOrange, "&:hover": { bgcolor: "#e64e1e" }, whiteSpace: "nowrap" }}
            >
              Add Camera
            </Button>
          </Box>

          {/* Stats cards */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
              gap: 2,
            }}
          >
            {[
              { label: "TOTAL CAMERAS", value: cameras === null ? "—" : String(cameras.length).padStart(2, "0") },
              { label: "STORAGE STATUS", value: "—" },
              { label: "SYSTEM HEALTH", value: "—" },
              { label: "ALERTS (24H)", value: "—" },
            ].map((metric) => (
              <Paper
                key={metric.label}
                variant="outlined"
                sx={{ p: 2, bgcolor: shellTokens.surface.panel, borderColor: shellTokens.border.subtle }}
              >
                <Typography
                  sx={{
                    fontFamily: "Inter",
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: shellTokens.text.secondary,
                    textTransform: "uppercase",
                  }}
                >
                  {metric.label}
                </Typography>
                <Typography variant="h4" fontWeight={700} sx={{ mt: 0.75 }}>
                  {metric.value}
                </Typography>
              </Paper>
            ))}
          </Box>

          {/* Camera table */}
          <Paper
            variant="outlined"
            sx={{ bgcolor: shellTokens.surface.panel, borderColor: shellTokens.border.subtle, overflowX: "auto" }}
          >
            <Table size="small" aria-label="camera management table">
              <TableHead>
                <TableRow sx={{ "& .MuiTableCell-head": { color: shellTokens.text.secondary, fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" } }}>
                  <TableCell>Status</TableCell>
                  <TableCell>Camera Name/Description</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Streams</TableCell>
                  <TableCell>Storage Dir</TableCell>
                  <TableCell align="right">Actions</TableCell>

                </TableRow>
              </TableHead>
              <TableBody>
                {cameras === null ? (
                  <TableRow>
                    <TableCell colSpan={6}>Loading…</TableCell>
                  </TableRow>
                ) : cameras.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>No cameras configured.</TableCell>
                  </TableRow>
                ) : (
                  cameras.map((cam) => {
                    const status = cameraStatus(cam);
                    const offline = status.color === "danger";
                    return (
                      <TableRow
                        key={cam.id}
                        sx={{
                          bgcolor: offline ? "rgba(255,92,92,0.05)" : "transparent",
                          "&:hover": { bgcolor: offline ? "rgba(255,92,92,0.08)" : shellTokens.surface.raised },
                          borderBottom: `1px solid ${shellTokens.border.subtle}`,
                        }}
                      >
                        <TableCell sx={{ py: 1.5 }}>
                          <StatusCell status={status} />
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {cam.shortName}
                          </Typography>
                          {cam.description && (
                            <Typography variant="caption" color="text.secondary">
                              {cam.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <IpChip ip={cameraIp(cam)} />
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                            {cam.streams.some((s) => s.mode === "record") ? (
                              cam.streams
                                .filter((s) => s.mode === "record")
                                .map((s) => (
                                  <StreamBadge key={s.id} stream={s} offline={offline} />
                                ))
                            ) : (
                              <Typography variant="body2" color="text.secondary">—</Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1.5, fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", color: shellTokens.text.secondary }}>
                          {storageLabel(cam)}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => { setEditTarget(cam); setDialogOpen(true); }}
                            aria-label={`edit ${cam.shortName}`}
                            sx={{ color: shellTokens.text.secondary, "&:hover": { color: shellTokens.text.primary } }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(cam)}
                            aria-label={`delete ${cam.shortName}`}
                            sx={{ color: shellTokens.text.secondary, "&:hover": { color: "#ff5c5c" } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
        <AddEditDialog
          open={dialogOpen}
          camera={editTarget}
          csrf={csrf}
          onClose={() => { setDialogOpen(false); setEditTarget(null); }}
          onSaved={handleSaved}
        />

      </Container>
    </Frame>
  );
}
