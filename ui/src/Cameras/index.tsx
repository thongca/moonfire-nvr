// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import React, { useEffect, useState } from "react";
import * as api from "../api";
import { useSnackbars } from "../snackbars";
import { FrameProps } from "../App";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddEditDialog from "./AddEditDialog";

interface Props {
  Frame: React.ComponentType<FrameProps>;
  csrf?: string;
}

export default function CamerasActivity({ Frame, csrf }: Props) {
  const [cameras, setCameras] = useState<api.CameraAdminEntry[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<api.CameraAdminEntry | null>(
    null,
  );
  const snackbars = useSnackbars();

  const fetchCameras = async () => {
    const resp = await api.getCamerasAdmin({});
    if (resp.status === "success") {
      setCameras(resp.response.cameras);
    } else if (resp.status === "error") {
      snackbars.enqueue({ message: "Failed to load cameras: " + resp.message });
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

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
      <Container>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mt: 3,
            mb: 2,
          }}
        >
          <Typography variant="h5">Camera Management</Typography>
          <Button
            variant="contained"
            onClick={() => {
              setEditTarget(null);
              setDialogOpen(true);
            }}
          >
            + Add Camera
          </Button>
        </Box>
        {cameras === null ? (
          <Typography>Loading…</Typography>
        ) : cameras.length === 0 ? (
          <Typography>No cameras configured.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Streams</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cameras.map((cam) => (
                <TableRow key={cam.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {cam.shortName}
                    </Typography>
                    {cam.description && (
                      <Typography variant="caption" color="text.secondary">
                        {cam.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {cam.streams.map((s) => (
                        <Chip
                          key={s.id}
                          label={
                            s.mode === "record"
                              ? `${s.type_.toUpperCase()} REC`
                              : `${s.type_.toUpperCase()} OFF`
                          }
                          size="small"
                          color={s.mode === "record" ? "primary" : "default"}
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditTarget(cam);
                        setDialogOpen(true);
                      }}
                      aria-label={`edit ${cam.shortName}`}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(cam)}
                      aria-label={`delete ${cam.shortName}`}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <AddEditDialog
          open={dialogOpen}
          camera={editTarget}
          csrf={csrf}
          onClose={() => {
            setDialogOpen(false);
            setEditTarget(null);
          }}
          onSaved={handleSaved}
        />
      </Container>
    </Frame>
  );
}
