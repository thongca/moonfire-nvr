// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import { type ReactNode, useCallback, useEffect, useState } from "react";
import * as api from "../api";
import { useSnackbars } from "../snackbars";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { shellTokens } from "../theme";

const STREAM_TYPES = ["main", "sub", "ext"] as const;
type StreamTypeStr = (typeof STREAM_TYPES)[number];

interface StreamForm {
  mode: string;
  rtspUrl: string;
  rtspTransport: string;
  sampleFileDirId: string;
}

const defaultStreamForm = (): StreamForm => ({
  mode: "",
  rtspUrl: "",
  rtspTransport: "",
  sampleFileDirId: "",
});

const streamLabel = (type_: StreamTypeStr) => type_.toUpperCase();

const modeLabel = (mode: string) => (mode === "record" ? "Record" : "Off");

const transportLabel = (transport: string) => {
  if (transport === "tcp") return "TCP";
  if (transport === "udp") return "UDP";
  return "Auto";
};

function DialogSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Stack spacing={1.5}>
      <Typography
        component="h3"
        color="text.secondary"
        sx={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          lineHeight: "14px",
          textTransform: "uppercase",
        }}
      >
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

function StreamSummaryCard({
  type_,
  stream,
  sampleFileDirs,
  selected,
  onSelect,
}: {
  type_: StreamTypeStr;
  stream: StreamForm;
  sampleFileDirs: api.SampleFileDirEntry[];
  selected: boolean;
  onSelect: () => void;
}) {
  const hasRtsp = stream.rtspUrl.trim().length > 0;
  const dir = stream.sampleFileDirId
    ? sampleFileDirs.find((d) => d.id.toString() === stream.sampleFileDirId)
    : undefined;
  const storageLabel = stream.sampleFileDirId
    ? `Dir ${stream.sampleFileDirId}`
    : stream.mode === "record"
      ? "Storage dir missing"
      : "No storage directory";

  return (
    <ButtonBase
      component="div"
      data-testid={`stream-summary-${type_}`}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Select ${streamLabel(type_)} stream`}
      sx={{
        textAlign: "left",
        width: "100%",
        borderRadius: 1,
        "&:focus-visible": {
          boxShadow: `0 0 0 2px rgba(255, 87, 34, 0.28)`,
        },
      }}
    >
      <Paper
        sx={{
          background: selected
            ? `linear-gradient(180deg, rgba(255, 87, 34, 0.16), ${shellTokens.surface.raised})`
            : shellTokens.surface.raised,
          border: `1px solid ${
            selected
              ? shellTokens.primary.fireOrange
              : shellTokens.border.subtle
          }`,
          borderRadius: 1,
          color: "text.primary",
          p: 1.5,
          width: "100%",
        }}
      >
        <Stack spacing={1}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography
              sx={{
                color: selected
                  ? shellTokens.primary.fireOrange
                  : "text.secondary",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                lineHeight: "14px",
              }}
            >
              {streamLabel(type_)}
            </Typography>
            <Chip
              size="small"
              label={modeLabel(stream.mode)}
              color={stream.mode === "record" ? "primary" : "default"}
            />
          </Stack>
          <Typography
            sx={{ fontSize: 12, lineHeight: "16px" }}
            color="text.secondary"
          >
            {hasRtsp ? "RTSP configured" : "No RTSP URL"}
          </Typography>
          <Typography
            sx={{ fontSize: 11, lineHeight: "14px" }}
            color="text.secondary"
          >
            {transportLabel(stream.rtspTransport)}
          </Typography>
          <Typography
            sx={{ fontSize: 11, lineHeight: "14px" }}
            color={
              stream.mode === "record" && !stream.sampleFileDirId
                ? "warning.main"
                : "text.secondary"
            }
          >
            {dir ? `Dir ${dir.id}` : storageLabel}
          </Typography>
        </Stack>
      </Paper>
    </ButtonBase>
  );
}

interface Props {
  open: boolean;
  camera: api.CameraAdminEntry | null;
  csrf?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddEditDialog({
  open,
  camera,
  csrf,
  onClose,
  onSaved,
}: Props) {
  const snackbars = useSnackbars();
  const isEdit = camera !== null;
  const [shortName, setShortName] = useState("");
  const [description, setDescription] = useState("");
  const [onvifBaseUrl, setOnvifBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [activeStream, setActiveStream] = useState<StreamTypeStr>("main");
  const [streams, setStreams] = useState<Record<StreamTypeStr, StreamForm>>({
    main: defaultStreamForm(),
    sub: defaultStreamForm(),
    ext: defaultStreamForm(),
  });
  const [saving, setSaving] = useState(false);
  const [sampleFileDirs, setSampleFileDirs] = useState<
    api.SampleFileDirEntry[]
  >([]);
  const [loadingSampleFileDirs, setLoadingSampleFileDirs] = useState(false);
  const [createDirOpen, setCreateDirOpen] = useState(false);
  const [newDirPath, setNewDirPath] = useState("");
  const [creatingDir, setCreatingDir] = useState(false);

  const fetchSampleFileDirs = useCallback(async () => {
    setLoadingSampleFileDirs(true);
    try {
      const resp = await api.getSampleFileDirs({});
      if (resp.status === "success") {
        setSampleFileDirs(resp.response.sampleFileDirs);
      } else if (resp.status === "error") {
        snackbars.enqueue({
          message: "Failed to load storage directories: " + resp.message,
        });
      }
    } finally {
      setLoadingSampleFileDirs(false);
    }
  }, [snackbars]);

  useEffect(() => {
    if (!open) return;
    fetchSampleFileDirs();
    if (camera) {
      setShortName(camera.shortName);
      setDescription(camera.description);
      setOnvifBaseUrl(camera.onvifBaseUrl ?? "");
      setUsername(camera.hasCredentials ? "(unchanged)" : "");
      setPassword("");
      const s: Record<StreamTypeStr, StreamForm> = {
        main: defaultStreamForm(),
        sub: defaultStreamForm(),
        ext: defaultStreamForm(),
      };
      for (const st of camera.streams) {
        const key = st.type as StreamTypeStr;
        if (STREAM_TYPES.includes(key)) {
          s[key] = {
            mode: st.mode,
            rtspUrl: st.rtspUrl ?? "",
            rtspTransport: st.rtspTransport,
            sampleFileDirId: st.sampleFileDirId?.toString() ?? "",
          };
        }
      }
      setStreams(s);
    } else {
      setShortName("");
      setDescription("");
      setOnvifBaseUrl("");
      setUsername("");
      setPassword("");
      setStreams({
        main: defaultStreamForm(),
        sub: defaultStreamForm(),
        ext: defaultStreamForm(),
      });
    }
    setActiveStream("main");
  }, [open, camera, fetchSampleFileDirs]);

  const updateStream = (
    type_: StreamTypeStr,
    field: keyof StreamForm,
    value: string,
  ) => {
    setStreams((prev) => ({
      ...prev,
      [type_]: { ...prev[type_], [field]: value },
    }));
  };

  const saveStreams = async (cameraId: number) => {
    for (const type_ of STREAM_TYPES) {
      const sf = streams[type_];
      const streamResp = await api.updateCameraStream(
        cameraId,
        type_,
        {
          csrf,
          mode: sf.mode,
          rtspUrl: sf.rtspUrl || undefined,
          rtspTransport: sf.rtspTransport || undefined,
          sampleFileDirId: sf.sampleFileDirId
            ? parseInt(sf.sampleFileDirId, 10)
            : undefined,
        },
        {},
      );
      if (streamResp.status === "error") {
        snackbars.enqueue({
          message: `Stream ${type_} save failed: ${streamResp.message}`,
        });
        return false;
      }
    }
    return true;
  };

  const handleCreateSampleFileDir = async () => {
    const path = newDirPath.trim();
    if (!path) {
      snackbars.enqueue({ message: "Directory path is required" });
      return;
    }
    setCreatingDir(true);
    try {
      const resp = await api.createSampleFileDir({ csrf, path }, {});
      if (resp.status === "success") {
        const id = resp.response.id;
        const refreshed = await api.getSampleFileDirs({});
        if (refreshed.status === "success") {
          setSampleFileDirs(refreshed.response.sampleFileDirs);
        }
        updateStream(activeStream, "sampleFileDirId", id.toString());
        setCreateDirOpen(false);
        setNewDirPath("");
        snackbars.enqueue({ message: `Storage directory Dir ${id} created` });
      } else if (resp.status === "error") {
        snackbars.enqueue({
          message: "Create storage directory failed: " + resp.message,
        });
      }
    } finally {
      setCreatingDir(false);
    }
  };

  const handleSave = async () => {
    if (!shortName.trim()) {
      snackbars.enqueue({ message: "Short name is required" });
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const req: api.PatchCameraRequest = {
          csrf,
          shortName,
          description,
          onvifBaseUrl: onvifBaseUrl || undefined,
        };
        if (username !== "(unchanged)") req.username = username;
        if (password) req.password = password;
        const resp = await api.updateCamera(camera!.id, req, {});
        if (resp.status === "error") {
          snackbars.enqueue({ message: "Save failed: " + resp.message });
          return;
        }
        if (!(await saveStreams(camera!.id))) return;
      } else {
        const resp = await api.createCamera(
          {
            csrf,
            shortName,
            description,
            onvifBaseUrl: onvifBaseUrl || undefined,
            username: username || undefined,
            password: password || undefined,
          },
          {},
        );
        if (resp.status === "error") {
          snackbars.enqueue({ message: "Create failed: " + resp.message });
          return;
        }
        if (resp.status === "aborted") return;
        if (!(await saveStreams(resp.response.cameraId))) return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography
          component="div"
          sx={{ fontSize: 18, fontWeight: 700, lineHeight: "24px" }}
        >
          {isEdit ? `Edit Camera — ${camera!.shortName}` : "Add Camera"}
        </Typography>
        <Typography
          sx={{ fontSize: 12, lineHeight: "18px" }}
          color="text.secondary"
        >
          Configure identity, connection, and stream routing
        </Typography>
      </DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 1 }}
      >
        <DialogSection title="Camera Identity">
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField
                label="Short Name"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                required
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                size="small"
                fullWidth
              />
            </Grid>
          </Grid>
        </DialogSection>

        <Divider />

        <DialogSection title="Connection">
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="ONVIF Base URL"
                value={onvifBaseUrl}
                onChange={(e) => setOnvifBaseUrl(e.target.value)}
                placeholder="http://192.168.1.10"
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit ? "(leave blank to keep)" : ""}
                size="small"
                fullWidth
              />
            </Grid>
          </Grid>
        </DialogSection>

        <Divider />

        <DialogSection title="Stream Routing">
          <Grid container spacing={1.5}>
            {STREAM_TYPES.map((t) => (
              <Grid key={t} size={{ xs: 12, sm: 4 }}>
                <StreamSummaryCard
                  type_={t}
                  stream={streams[t]}
                  sampleFileDirs={sampleFileDirs}
                  selected={activeStream === t}
                  onSelect={() => setActiveStream(t)}
                />
              </Grid>
            ))}
          </Grid>

          <Box>
            <Tabs
              value={activeStream}
              onChange={(_, v: StreamTypeStr) => setActiveStream(v)}
              variant="fullWidth"
              sx={{
                borderBottom: `1px solid ${shellTokens.border.subtle}`,
                minHeight: 36,
                "& .MuiTab-root": {
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  minHeight: 36,
                  py: 0.75,
                },
              }}
            >
              {STREAM_TYPES.map((t) => (
                <Tab
                  key={t}
                  id={`stream-tab-${t}`}
                  aria-controls={`stream-panel-${t}`}
                  label={streamLabel(t)}
                  value={t}
                />
              ))}
            </Tabs>
            <Box
              key={activeStream}
              id={`stream-panel-${activeStream}`}
              role="tabpanel"
              aria-labelledby={`stream-tab-${activeStream}`}
              sx={{ pt: 2 }}
            >
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id={`stream-mode-label-${activeStream}`}>
                      Mode
                    </InputLabel>
                    <Select
                      labelId={`stream-mode-label-${activeStream}`}
                      id={`stream-mode-${activeStream}`}
                      value={streams[activeStream].mode}
                      label="Mode"
                      onChange={(e) =>
                        updateStream(activeStream, "mode", e.target.value)
                      }
                    >
                      <MenuItem value="">Off</MenuItem>
                      <MenuItem value="record">Record</MenuItem>
                    </Select>
                  </FormControl>
                  <Typography
                    sx={{ fontSize: 11, lineHeight: "16px" }}
                    color="text.secondary"
                  >
                    Record enables this stream for capture.
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <TextField
                    label="RTSP URL"
                    value={streams[activeStream].rtspUrl}
                    onChange={(e) =>
                      updateStream(activeStream, "rtspUrl", e.target.value)
                    }
                    placeholder="rtsp://192.168.1.10/stream1"
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id={`stream-transport-label-${activeStream}`}>
                      Transport
                    </InputLabel>
                    <Select
                      labelId={`stream-transport-label-${activeStream}`}
                      id={`stream-transport-${activeStream}`}
                      value={streams[activeStream].rtspTransport}
                      label="Transport"
                      onChange={(e) =>
                        updateStream(
                          activeStream,
                          "rtspTransport",
                          e.target.value,
                        )
                      }
                    >
                      <MenuItem value="">Auto</MenuItem>
                      <MenuItem value="tcp">TCP</MenuItem>
                      <MenuItem value="udp">UDP</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id={`stream-storage-dir-label-${activeStream}`}>
                      Storage Directory
                    </InputLabel>
                    <Select
                      labelId={`stream-storage-dir-label-${activeStream}`}
                      id={`stream-storage-dir-${activeStream}`}
                      value={streams[activeStream].sampleFileDirId}
                      label="Storage Directory"
                      disabled={loadingSampleFileDirs}
                      onChange={(e) =>
                        updateStream(
                          activeStream,
                          "sampleFileDirId",
                          e.target.value,
                        )
                      }
                    >
                      <MenuItem value="">No storage directory</MenuItem>
                      {sampleFileDirs.map((dir) => (
                        <MenuItem key={dir.id} value={dir.id.toString()}>
                          {`Dir ${dir.id} — ${dir.path}`}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Typography
                    sx={{ fontSize: 11, lineHeight: "16px", mt: 0.5 }}
                    color="text.secondary"
                  >
                    {sampleFileDirs.length === 0
                      ? "No storage directories configured yet. Create one here or with moonfire-nvr config → Directories and retention."
                      : "Choose where recordings for this stream are stored."}
                  </Typography>
                  {streams[activeStream].mode === "record" &&
                    !streams[activeStream].sampleFileDirId && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Recording requires a storage directory. Create or select
                        one before saving.
                      </Alert>
                    )}
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => setCreateDirOpen((open) => !open)}
                    fullWidth
                  >
                    Create directory
                  </Button>
                </Grid>
                {createDirOpen && (
                  <Grid size={{ xs: 12 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        label="Directory path"
                        value={newDirPath}
                        onChange={(e) => setNewDirPath(e.target.value)}
                        placeholder="/var/lib/moonfire-nvr/sample"
                        size="small"
                        fullWidth
                      />
                      <Button
                        type="button"
                        variant="contained"
                        onClick={handleCreateSampleFileDir}
                        disabled={creatingDir}
                      >
                        Create
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setCreateDirOpen(false);
                          setNewDirPath("");
                        }}
                        disabled={creatingDir}
                      >
                        Cancel
                      </Button>
                    </Stack>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Box>
        </DialogSection>
      </DialogContent>
      <DialogActions
        sx={{
          borderTop: `1px solid ${shellTokens.border.subtle}`,
          position: "sticky",
          bottom: 0,
          background: shellTokens.surface.panel,
        }}
      >
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
