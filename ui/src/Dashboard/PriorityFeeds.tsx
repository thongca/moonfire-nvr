// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import Typography from "@mui/material/Typography";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SettingsIcon from "@mui/icons-material/Settings";
import { shellTokens } from "../theme";
import * as api from "../api";
import type { CameraAdminEntry } from "../api";

const STORAGE_KEY = "nvr.priorityFeeds";
const MAX_TILES = 4;

/** Static placeholder specs for the four tiles */
const STATIC_TILES = [
  { name: "CAM-04: Loading Dock A", spec: "1080p|30fps|4.2Mbps" },
  { name: "CAM-12: Main Entrance", spec: "4K|24fps|8.1Mbps" },
  { name: "CAM-08: Server Room 1", spec: "1080p|15fps|2.8Mbps" },
  { name: "CAM-22: Perimeter North", spec: "720p|16fps|1.1Mbps" },
];

function loadSelectedIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as number[];
  } catch {
    // ignore
  }
  return [];
}

/** A filled camera tile */
function FilledTile({
  index,
  name,
  spec,
}: {
  index: number;
  name: string;
  spec: string;
}) {
  return (
    <Box
      sx={{
        bgcolor: shellTokens.surface.raised,
        borderRadius: `${shellTokens.radius.base}px`,
        border: `1px solid ${shellTokens.border.subtle}`,
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        minHeight: 120,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* REC badge */}
      <Box
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          bgcolor: "#cc2200",
          color: "#fff",
          fontSize: "0.6rem",
          fontWeight: 700,
          px: 0.75,
          py: 0.25,
          borderRadius: 0.5,
          letterSpacing: "0.08em",
        }}
      >
        REC
      </Box>

      {/* Motion detected badge on first tile */}
      {index === 0 && (
        <Box
          sx={{
            position: "absolute",
            bottom: 8,
            left: 8,
            bgcolor: "#ff5722cc",
            color: "#fff",
            fontSize: "0.6rem",
            fontWeight: 700,
            px: 0.75,
            py: 0.25,
            borderRadius: 0.5,
            letterSpacing: "0.06em",
          }}
        >
          MOTION DETECTED
        </Box>
      )}

      <Typography
        variant="caption"
        sx={{
          color: shellTokens.text.primary,
          fontWeight: 700,
          fontSize: "0.75rem",
          lineHeight: 1.3,
          pr: 4,
        }}
      >
        {name}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: shellTokens.text.secondary,
          fontSize: "0.65rem",
          letterSpacing: "0.04em",
        }}
      >
        {spec}
      </Typography>
    </Box>
  );
}

/** An empty camera tile with an "Add Camera" button */
function EmptyTile({ onAdd }: { onAdd: () => void }) {
  return (
    <Box
      sx={{
        bgcolor: shellTokens.surface.panel,
        borderRadius: `${shellTokens.radius.base}px`,
        border: `1px dashed ${shellTokens.border.subtle}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.75,
        minHeight: 120,
        cursor: "pointer",
        "&:hover": {
          borderColor: shellTokens.primary.fireOrange,
        },
      }}
      onClick={onAdd}
    >
      <AddCircleOutlineIcon
        sx={{ color: shellTokens.text.secondary, fontSize: "1.5rem" }}
      />
      <Typography
        variant="caption"
        sx={{ color: shellTokens.text.secondary, fontWeight: 600 }}
      >
        Add Camera
      </Typography>
    </Box>
  );
}

/** Configure modal — fetches camera list, lets user pick up to MAX_TILES */
function ConfigureModal({
  open,
  onClose,
  onConfirm,
  initialIds,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (ids: number[]) => void;
  initialIds: number[];
}) {
  const [cameras, setCameras] = useState<CameraAdminEntry[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set(initialIds));

  React.useEffect(() => {
    if (!open) return;
    // Reset selection to current persisted value whenever dialog opens
    setSelected(new Set(initialIds));
    const controller = new AbortController();
    api.getCamerasAdmin({ signal: controller.signal }).then((result) => {
      if (result.status === "success") {
        setCameras(result.response.cameras);
      }
    });
    return () => controller.abort();
  }, [open, initialIds]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_TILES) {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Configure Priority Feeds</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 1.5, color: shellTokens.text.secondary }}>
          Select up to {MAX_TILES} cameras to display in Priority Feeds.
        </Typography>
        <FormGroup>
          {cameras.map((cam) => (
            <FormControlLabel
              key={cam.id}
              control={
                <Checkbox
                  checked={selected.has(cam.id)}
                  onChange={() => toggle(cam.id)}
                  inputProps={{ "aria-label": cam.shortName }}
                />
              }
              label={cam.shortName}
            />
          ))}
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(Array.from(selected))}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PriorityFeeds() {
  const [selectedIds, setSelectedIds] = useState<number[]>(loadSelectedIds);
  const [modalOpen, setModalOpen] = useState(false);

  function handleConfirm(ids: number[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    setSelectedIds(ids);
    setModalOpen(false);
  }

  return (
    <Box>
      {/* Header row */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1.5,
        }}
      >
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{ color: shellTokens.text.primary }}
        >
          Priority Feeds
        </Typography>
        <Button
          size="small"
          startIcon={<SettingsIcon />}
          onClick={() => setModalOpen(true)}
          sx={{ color: shellTokens.text.secondary, textTransform: "none" }}
        >
          Configure
        </Button>
      </Box>

      {/* 2×2 grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 1.5,
        }}
      >
        {Array.from({ length: MAX_TILES }).map((_, i) => {
          const cameraId = selectedIds[i];
          if (cameraId != null) {
            // Show a filled tile — use static tile data for the display info
            const tile = STATIC_TILES[i] ?? {
              name: `Camera ${cameraId}`,
              spec: "",
            };
            return (
              <FilledTile
                key={i}
                index={i}
                name={tile.name}
                spec={tile.spec}
              />
            );
          }
          return (
            <EmptyTile key={i} onAdd={() => setModalOpen(true)} />
          );
        })}
      </Box>

      <ConfigureModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirm}
        initialIds={selectedIds}
      />
    </Box>
  );
}
