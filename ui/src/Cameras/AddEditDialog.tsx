// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import { useEffect, useState } from "react";
import * as api from "../api";
import { useSnackbars } from "../snackbars";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";

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

  useEffect(() => {
    if (!open) return;
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
  }, [open, camera]);

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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEdit ? `Edit Camera — ${camera!.shortName}` : "Add Camera"}
      </DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}
      >
        <TextField
          label="Short Name"
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          required
          size="small"
          fullWidth
        />
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="ONVIF Base URL"
          value={onvifBaseUrl}
          onChange={(e) => setOnvifBaseUrl(e.target.value)}
          placeholder="http://192.168.1.10"
          size="small"
          fullWidth
        />
        <TextField
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isEdit ? "(leave blank to keep)" : ""}
          size="small"
          fullWidth
        />
        <Box>
          <Tabs
            value={activeStream}
            onChange={(_, v: StreamTypeStr) => setActiveStream(v)}
            variant="fullWidth"
          >
            {STREAM_TYPES.map((t) => (
              <Tab key={t} label={t.toUpperCase()} value={t} />
            ))}
          </Tabs>
          {STREAM_TYPES.map((t) => (
            <Box
              key={t}
              role="tabpanel"
              hidden={activeStream !== t}
              sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 1.5 }}
            >
              <FormControl size="small" fullWidth>
                <InputLabel>Mode</InputLabel>
                <Select
                  value={streams[t].mode}
                  label="Mode"
                  onChange={(e) => updateStream(t, "mode", e.target.value)}
                >
                  <MenuItem value="">Off</MenuItem>
                  <MenuItem value="record">Record</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="RTSP URL"
                value={streams[t].rtspUrl}
                onChange={(e) => updateStream(t, "rtspUrl", e.target.value)}
                placeholder="rtsp://192.168.1.10/stream1"
                size="small"
                fullWidth
              />
              <FormControl size="small" fullWidth>
                <InputLabel>Transport</InputLabel>
                <Select
                  value={streams[t].rtspTransport}
                  label="Transport"
                  onChange={(e) =>
                    updateStream(t, "rtspTransport", e.target.value)
                  }
                >
                  <MenuItem value="">Auto</MenuItem>
                  <MenuItem value="tcp">TCP</MenuItem>
                  <MenuItem value="udp">UDP</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Sample File Dir ID"
                value={streams[t].sampleFileDirId}
                onChange={(e) =>
                  updateStream(t, "sampleFileDirId", e.target.value)
                }
                size="small"
                type="number"
                fullWidth
              />
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
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
