// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

/**
 * @fileoverview Camera Config sub-section for the Settings page.
 */

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import * as api from "../api";
import {
  cameraIp,
  cameraRecordingStatus,
  retentionSummary,
} from "../Cameras/viewModel";
import AddEditDialog from "../Cameras/AddEditDialog";
import { IpChip, StatusDot } from "../Cameras/CameraRowPrimitives";
import { useSnackbars } from "../snackbars";
import { shellTokens } from "../theme";

// ---- Props ----

interface Props {
  csrf?: string;
}

// ---- Component ----

export default function CameraConfig({ csrf }: Props) {
  const [cameras, setCameras] = useState<api.CameraAdminEntry[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCamera, setEditCamera] = useState<api.CameraAdminEntry | null>(
    null,
  );
  const snackbars = useSnackbars();

  const fetchCameras = useCallback(async () => {
    const result = await api.getCamerasAdmin({});
    if (result.status === "success") {
      setCameras(result.response.cameras);
    } else if (result.status === "error") {
      snackbars.enqueue({
        message: "Failed to load cameras: " + result.message,
      });
      setCameras([]);
    }
  }, [snackbars]);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  const handleAdd = () => {
    setEditCamera(null);
    setDialogOpen(true);
  };

  const handleEdit = (camera: api.CameraAdminEntry) => {
    setEditCamera(camera);
    setDialogOpen(true);
  };

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
    fetchCameras();
  };

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, color: shellTokens.text.primary }}
        >
          Camera Configuration
        </Typography>
        <Button
          variant="contained"
          onClick={handleAdd}
          sx={{
            bgcolor: shellTokens.primary.fireOrange,
            textTransform: "none",
            fontWeight: 600,
            "&:hover": { bgcolor: "#e64e1e" },
          }}
        >
          + Add Camera
        </Button>
      </Box>

      {/* Table */}
      <TableContainer
        sx={{
          border: `1px solid ${shellTokens.border.subtle}`,
          borderRadius: `${shellTokens.radius.base / 8}px`,
          bgcolor: shellTokens.surface.panel,
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              {[
                "Camera Name",
                "IP Address",
                "Recording Status",
                "Retention",
                "Actions",
              ].map((col) => (
                <TableCell
                  key={col}
                  sx={{
                    color: shellTokens.text.secondary,
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    borderBottom: `1px solid ${shellTokens.border.subtle}`,
                    py: 1.25,
                  }}
                >
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {cameras === null ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Loading…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : cameras.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No cameras configured.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              cameras.map((camera) => {
                const ip = cameraIp(camera);
                const recordingStatus = cameraRecordingStatus(camera);
                const retention = retentionSummary(camera);
                const healthy = recordingStatus.color === "success";
                return (
                  <TableRow
                    key={camera.id}
                    sx={{
                      bgcolor: healthy
                        ? undefined
                        : recordingStatus.color === "warning"
                          ? "rgba(245, 165, 36, 0.06)"
                          : "rgba(255, 92, 92, 0.05)",
                      "&:last-child td": { border: 0 },
                    }}
                  >
                    {/* Camera Name */}
                    <TableCell sx={{ py: 1.25 }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <StatusDot online={healthy} />
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 500,
                            color: shellTokens.text.primary,
                          }}
                        >
                          {camera.shortName}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* IP Address */}
                    <TableCell sx={{ py: 1.25 }}>
                      <IpChip ip={ip} />
                    </TableCell>

                    {/* Recording Status */}
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color:
                            recordingStatus.color === "danger"
                              ? "#ff5c5c"
                              : recordingStatus.color === "warning"
                                ? "#f5a524"
                                : shellTokens.text.primary,
                        }}
                      >
                        {recordingStatus.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {recordingStatus.detail}
                      </Typography>
                    </TableCell>

                    {/* Retention */}
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography variant="body2" color="text.secondary">
                        {retention}
                      </Typography>
                    </TableCell>

                    {/* Actions */}
                    <TableCell sx={{ py: 1.25 }}>
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        <IconButton
                          size="small"
                          aria-label={`Edit ${camera.shortName}`}
                          onClick={() => handleEdit(camera)}
                          sx={{ color: shellTokens.text.secondary }}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label={`Delete ${camera.shortName}`}
                          onClick={() => handleDelete(camera)}
                          sx={{ color: "#ff5c5c" }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <AddEditDialog
        open={dialogOpen}
        camera={editCamera}
        csrf={csrf}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />
    </Box>
  );
}
