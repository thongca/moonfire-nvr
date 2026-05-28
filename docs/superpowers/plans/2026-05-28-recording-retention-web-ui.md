# Recording & Retention Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose per-stream retention and metadata flush controls in the web camera dialog, and replace vague camera status with recording-specific status derived from real configuration/runtime counters.

**Architecture:** Extend the existing camera admin API to round-trip `retainBytes` and `flushIfSec`, then keep the UI changes inside the existing camera management files. Add small view-model helpers for byte parsing/formatting and recording-status derivation so tests can validate behavior without rendering the whole app.

**Tech Stack:** Rust backend with serde/rusqlite, React + TypeScript + MUI, Vitest/MSW, Cargo tests.

---

## File Structure

- `server/src/json.rs` — add `retain_bytes` and `flush_if_sec` to admin API request/response structs.
- `server/src/web/cameras_admin.rs` — serialize and apply the new stream config fields.
- `server/src/web/mod.rs` — extend existing web API tests or add focused tests for camera stream updates.
- `ui/src/api.ts` — add `retainBytes` and `flushIfSec` to stream request/response types.
- `ui/src/Cameras/viewModel.ts` — add byte parsing/formatting and recording status helpers.
- `ui/src/Cameras/viewModel.test.ts` — create focused tests for helpers.
- `ui/src/Cameras/AddEditDialog.tsx` — render and validate retention/flush fields and include them in saves.
- `ui/src/Cameras/AddEditDialog.test.tsx` — cover rendering, validation, and save payloads.
- `ui/src/Settings/CameraConfig.tsx` — show recording status and retention/storage summaries in the table.
- `ui/src/Settings/CameraConfig.test.tsx` — cover the new table labels.

---

### Task 1: Backend Admin API Round-Trips Retention Fields

**Files:**
- Modify: `server/src/json.rs`
- Modify: `server/src/web/cameras_admin.rs`
- Test: `server/src/web/mod.rs`

- [ ] **Step 1: Write a failing backend test for stream retention fields**

Add a test in `server/src/web/mod.rs` inside the existing `#[cfg(test)] mod tests` block:

```rust
#[tokio::test]
async fn camera_stream_admin_round_trips_retention_fields() {
    let s = Server::new();
    let client = reqwest::Client::new();

    let create_resp: json::PostCameraResponse = client
        .post(format!("{}/api/cameras", s.base_url))
        .json(&serde_json::json!({
            "shortName": "retention-cam",
            "description": "Retention test camera"
        }))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json()
        .await
        .unwrap();

    client
        .put(format!(
            "{}/api/cameras/{}/streams/main",
            s.base_url, create_resp.camera_id
        ))
        .json(&serde_json::json!({
            "mode": "record",
            "rtspUrl": "rtsp://example.test/main",
            "rtspTransport": "tcp",
            "sampleFileDirId": null,
            "retainBytes": 50_000_000_000_i64,
            "flushIfSec": 120
        }))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap();

    let resp: json::GetCamerasAdminResponse = client
        .get(format!("{}/api/cameras", s.base_url))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json()
        .await
        .unwrap();

    let camera = resp
        .cameras
        .iter()
        .find(|camera| camera.id == create_resp.camera_id)
        .unwrap();
    let main = camera
        .streams
        .iter()
        .find(|stream| stream.type_ == "main")
        .unwrap();
    assert_eq!(main.retain_bytes, 50_000_000_000);
    assert_eq!(main.flush_if_sec, 120);
}
```

- [ ] **Step 2: Run the backend test and verify it fails**

Run:

```bash
RUSTFLAGS='--cfg tokio_unstable --cfg tokio_taskdump' /home/ai/.cargo/bin/cargo test --manifest-path server/Cargo.toml --features bundled camera_stream_admin_round_trips_retention_fields -- --nocapture
```

Expected: FAIL to compile because `StreamAdminEntry` has no `retain_bytes` / `flush_if_sec`, or FAIL assertions because the fields are absent/default.

- [ ] **Step 3: Extend backend JSON structs**

In `server/src/json.rs`, update `PutCameraStreamRequest`:

```rust
pub struct PutCameraStreamRequest {
    pub csrf: Option<String>,
    #[serde(default)]
    pub mode: String, // "record" or "" (off)
    pub rtsp_url: Option<url::Url>,
    #[serde(default)]
    pub rtsp_transport: String, // "tcp", "udp", or ""
    pub sample_file_dir_id: Option<i32>,
    #[serde(default)]
    pub retain_bytes: i64,
    #[serde(default)]
    pub flush_if_sec: u32,
}
```

Also update `StreamAdminEntry`:

```rust
pub struct StreamAdminEntry {
    pub id: i32,
    pub type_: String,
    pub mode: String,
    pub rtsp_url: Option<String>,
    pub rtsp_transport: String,
    pub sample_file_dir_id: Option<i32>,
    pub retain_bytes: i64,
    pub flush_if_sec: u32,
}
```

- [ ] **Step 4: Serialize and apply backend fields**

In `server/src/web/cameras_admin.rs`, when building each `json::StreamAdminEntry`, include:

```rust
retain_bytes: locked.config.retain_bytes,
flush_if_sec: locked.config.flush_if_sec,
```

In `camera_stream_admin`, after setting `mode`, `rtsp_url`, `rtsp_transport`, and `sample_file_dir_id`, also set:

```rust
change.streams[si].config.retain_bytes = r.retain_bytes;
change.streams[si].config.flush_if_sec = r.flush_if_sec;
```

- [ ] **Step 5: Run backend test and verify it passes**

Run:

```bash
RUSTFLAGS='--cfg tokio_unstable --cfg tokio_taskdump' /home/ai/.cargo/bin/cargo test --manifest-path server/Cargo.toml --features bundled camera_stream_admin_round_trips_retention_fields -- --nocapture
```

Expected: PASS with `1 passed; 0 failed` for the targeted test.

---

### Task 2: Add UI View-Model Helpers

**Files:**
- Modify: `ui/src/Cameras/viewModel.ts`
- Create: `ui/src/Cameras/viewModel.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `ui/src/Cameras/viewModel.test.ts`:

```typescript
import { describe, expect, test } from "vitest";
import {
  cameraRecordingStatus,
  formatRetentionBytes,
  parseRetentionBytes,
  retentionSummary,
} from "./viewModel";
import type * as api from "../api";

const camera = (streams: api.StreamAdminEntry[]): api.CameraAdminEntry => ({
  id: 1,
  uuid: "camera-1",
  shortName: "Camera 1",
  description: "",
  hasCredentials: false,
  streams,
});

const stream = (
  overrides: Partial<api.StreamAdminEntry>,
): api.StreamAdminEntry => ({
  id: 1,
  type: "main",
  mode: "",
  rtspTransport: "",
  retainBytes: 0,
  flushIfSec: 0,
  ...overrides,
});

describe("retention helpers", () => {
  test("parses human retention sizes", () => {
    expect(parseRetentionBytes("0")).toEqual({ ok: true, bytes: 0 });
    expect(parseRetentionBytes("500 MB")).toEqual({ ok: true, bytes: 500_000_000 });
    expect(parseRetentionBytes("50 GB")).toEqual({ ok: true, bytes: 50_000_000_000 });
    expect(parseRetentionBytes("1 TB")).toEqual({ ok: true, bytes: 1_000_000_000_000 });
  });

  test("rejects invalid retention sizes", () => {
    expect(parseRetentionBytes("abc")).toEqual({
      ok: false,
      message: "Enter a size like 50 GB, 1 TB, 500 MB, or 0.",
    });
    expect(parseRetentionBytes("-1 GB")).toEqual({
      ok: false,
      message: "Retention limit cannot be negative.",
    });
  });

  test("formats retention bytes", () => {
    expect(formatRetentionBytes(0)).toBe("Unlimited");
    expect(formatRetentionBytes(50_000_000_000)).toBe("50 GB");
  });
});

describe("camera recording status", () => {
  test("marks record mode without storage as needs storage", () => {
    expect(cameraRecordingStatus(camera([stream({ mode: "record" })]))).toEqual({
      label: "Needs storage",
      color: "warning",
      detail: "main: select a storage directory",
    });
  });

  test("marks configured recording as waiting for frames", () => {
    expect(
      cameraRecordingStatus(
        camera([stream({ mode: "record", sampleFileDirId: 7 })]),
      ),
    ).toEqual({
      label: "Waiting for frames",
      color: "warning",
      detail: "main: configured, no frames yet",
    });
  });

  test("summarizes retention", () => {
    expect(retentionSummary(camera([]))).toBe("—");
    expect(retentionSummary(camera([stream({ mode: "record", retainBytes: 0 })]))).toBe("Unlimited");
    expect(
      retentionSummary(
        camera([stream({ mode: "record", retainBytes: 50_000_000_000 })]),
      ),
    ).toBe("50 GB limit");
  });
});
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run:

```bash
cd ui && npm test -- Cameras/viewModel.test.ts --run
```

Expected: FAIL because the new helper functions and fields do not exist yet.

- [ ] **Step 3: Implement helper functions**

Append to `ui/src/Cameras/viewModel.ts`:

```typescript
export type RetentionParseResult =
  | { ok: true; bytes: number }
  | { ok: false; message: string };

export function parseRetentionBytes(input: string): RetentionParseResult {
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(b|bytes?|kb|mb|gb|tb)?$/i);
  if (match === null) {
    return {
      ok: false,
      message: "Enter a size like 50 GB, 1 TB, 500 MB, or 0.",
    };
  }
  const value = Number(match[1]);
  if (value < 0) {
    return { ok: false, message: "Retention limit cannot be negative." };
  }
  const unit = (match[2] ?? "b").toLowerCase();
  const multiplier =
    unit === "tb" ? 1_000_000_000_000 :
    unit === "gb" ? 1_000_000_000 :
    unit === "mb" ? 1_000_000 :
    unit === "kb" ? 1_000 :
    1;
  return { ok: true, bytes: Math.round(value * multiplier) };
}

export function formatRetentionBytes(bytes: number): string {
  if (bytes === 0) return "Unlimited";
  const units: Array<[string, number]> = [
    ["TB", 1_000_000_000_000],
    ["GB", 1_000_000_000],
    ["MB", 1_000_000],
    ["KB", 1_000],
  ];
  for (const [unit, size] of units) {
    if (bytes >= size && bytes % size === 0) {
      return `${bytes / size} ${unit}`;
    }
    if (bytes >= size) {
      return `${(bytes / size).toFixed(1)} ${unit}`;
    }
  }
  return `${bytes} bytes`;
}

export function retentionSummary(camera: api.CameraAdminEntry): string {
  const recording = camera.streams.filter((stream) => stream.mode === "record");
  if (recording.length === 0) return "—";
  const total = recording.reduce(
    (sum, stream) => sum + (stream.retainBytes ?? 0),
    0,
  );
  return total === 0 ? "Unlimited" : `${formatRetentionBytes(total)} limit`;
}

export function cameraRecordingStatus(camera: api.CameraAdminEntry): {
  label: string;
  color: "success" | "warning" | "danger";
  detail: string;
} {
  const recording = camera.streams.find((stream) => stream.mode === "record");
  if (recording === undefined) {
    return { label: "Not configured", color: "danger", detail: "No streams recording" };
  }
  if (recording.sampleFileDirId === undefined || recording.sampleFileDirId === null) {
    return {
      label: "Needs storage",
      color: "warning",
      detail: `${recording.type}: select a storage directory`,
    };
  }
  return {
    label: "Waiting for frames",
    color: "warning",
    detail: `${recording.type}: configured, no frames yet`,
  };
}
```

- [ ] **Step 4: Run helper tests and verify they pass**

Run:

```bash
cd ui && npm test -- Cameras/viewModel.test.ts --run
```

Expected: PASS.

---

### Task 3: Update UI API Types

**Files:**
- Modify: `ui/src/api.ts`

- [ ] **Step 1: Add stream admin fields to TypeScript types**

In `ui/src/api.ts`, update `StreamAdminEntry`:

```typescript
export interface StreamAdminEntry {
  id: number;
  type: string;
  mode: string;
  rtspUrl?: string | null;
  rtspTransport: string;
  sampleFileDirId?: number | null;
  retainBytes: number;
  flushIfSec: number;
}
```

Update `PutCameraStreamRequest`:

```typescript
export interface PutCameraStreamRequest {
  csrf?: string;
  mode: string;
  rtspUrl?: string;
  rtspTransport?: string;
  sampleFileDirId?: number;
  retainBytes: number;
  flushIfSec: number;
}
```

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
cd ui && npm run build
```

Expected: FAIL until fixtures and save payloads include the required fields; later tasks fix this. If it already passes because fields are optional elsewhere, continue.

---

### Task 4: Add Retention Fields to Add/Edit Dialog

**Files:**
- Modify: `ui/src/Cameras/AddEditDialog.tsx`
- Modify: `ui/src/Cameras/AddEditDialog.test.tsx`

- [ ] **Step 1: Write failing dialog tests**

Add these tests to `ui/src/Cameras/AddEditDialog.test.tsx`:

```typescript
test("renders retention and flush settings for an existing stream", async () => {
  mockSampleFileDirs([{ id: 7, path: "/var/lib/moonfire-nvr/sample" }]);

  renderWithCtx(
    <AddEditDialog
      open={true}
      camera={{
        id: 1,
        uuid: "camera-1",
        shortName: "Front Door",
        description: "",
        hasCredentials: false,
        streams: [
          {
            id: 10,
            type: "main",
            mode: "record",
            rtspUrl: "rtsp://camera/main",
            rtspTransport: "tcp",
            sampleFileDirId: 7,
            retainBytes: 50_000_000_000,
            flushIfSec: 120,
          },
        ],
      }}
      csrf="csrf-token"
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );

  expect(await screen.findByLabelText("Retention Limit")).toHaveValue("50 GB");
  expect(screen.getByLabelText("Metadata Flush Interval")).toHaveValue(120);
  expect(
    screen.getByText("Moonfire currently retains recordings by storage quota, not by number of days."),
  ).toBeInTheDocument();
});

test("saves parsed retention and flush settings", async () => {
  const user = userEvent.setup();
  let streamBody: any = null;

  server.use(
    http.post("/api/cameras", () => HttpResponse.json({ cameraId: 42 })),
    http.put("/api/cameras/42/streams/main", async ({ request }) => {
      streamBody = await request.json();
      return new HttpResponse(null, { status: 204 });
    }),
    http.put("/api/cameras/42/streams/sub", () => new HttpResponse(null, { status: 204 })),
    http.put("/api/cameras/42/streams/ext", () => new HttpResponse(null, { status: 204 })),
  );
  mockSampleFileDirs();
  renderAddDialog();

  await user.type(screen.getByLabelText(/Short Name/), "Front Door");
  await user.click(screen.getByLabelText("Mode"));
  await user.click(screen.getByRole("option", { name: "Record" }));
  await user.type(screen.getByLabelText("RTSP URL"), "rtsp://camera/main");
  await user.click(screen.getByLabelText("Storage Directory"));
  await user.click(screen.getByRole("option", { name: "Dir 7 — /var/lib/moonfire-nvr/sample" }));
  await user.clear(screen.getByLabelText("Retention Limit"));
  await user.type(screen.getByLabelText("Retention Limit"), "50 GB");
  await user.clear(screen.getByLabelText("Metadata Flush Interval"));
  await user.type(screen.getByLabelText("Metadata Flush Interval"), "120");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  await waitFor(() => expect(streamBody).not.toBeNull());
  expect(streamBody).toMatchObject({
    retainBytes: 50_000_000_000,
    flushIfSec: 120,
  });
});

test("blocks saving invalid retention input", async () => {
  const user = userEvent.setup();
  let createCalled = false;
  server.use(
    http.post("/api/cameras", () => {
      createCalled = true;
      return HttpResponse.json({ cameraId: 42 });
    }),
  );
  mockSampleFileDirs();
  renderAddDialog();

  await user.type(screen.getByLabelText(/Short Name/), "Front Door");
  await user.clear(screen.getByLabelText("Retention Limit"));
  await user.type(screen.getByLabelText("Retention Limit"), "seven days");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  expect(
    await screen.findByText("Enter a size like 50 GB, 1 TB, 500 MB, or 0."),
  ).toBeInTheDocument();
  expect(createCalled).toBe(false);
});
```

- [ ] **Step 2: Run dialog tests and verify they fail**

Run:

```bash
cd ui && npm test -- Cameras/AddEditDialog.test.tsx --run
```

Expected: FAIL because the fields do not exist.

- [ ] **Step 3: Extend local stream form state**

In `ui/src/Cameras/AddEditDialog.tsx`, import helpers:

```typescript
import { formatRetentionBytes, parseRetentionBytes } from "./viewModel";
```

Update `StreamForm`:

```typescript
type StreamForm = {
  mode: string;
  rtspUrl: string;
  rtspTransport: string;
  sampleFileDirId: string;
  retainBytes: string;
  flushIfSec: string;
};
```

Update `defaultStreamForm`:

```typescript
const defaultStreamForm = (): StreamForm => ({
  mode: "",
  rtspUrl: "",
  rtspTransport: "",
  sampleFileDirId: "",
  retainBytes: "0",
  flushIfSec: "120",
});
```

When hydrating from an existing camera stream, set:

```typescript
retainBytes: formatRetentionBytes(st.retainBytes ?? 0),
flushIfSec: (st.flushIfSec ?? 0).toString(),
```

- [ ] **Step 4: Add validation state and save parsing**

Add component state:

```typescript
const [retentionError, setRetentionError] = useState<string | null>(null);
const [flushError, setFlushError] = useState<string | null>(null);
```

At the start of `saveStreams`, parse each stream before sending:

```typescript
const retention = parseRetentionBytes(sf.retainBytes);
if (!retention.ok) {
  setActiveStream(type_);
  setRetentionError(retention.message);
  return false;
}
const flushIfSec = Number(sf.flushIfSec);
if (!Number.isInteger(flushIfSec) || flushIfSec < 0) {
  setActiveStream(type_);
  setFlushError("Enter a non-negative whole number of seconds.");
  return false;
}
```

Include in `api.updateCameraStream` request:

```typescript
retainBytes: retention.bytes,
flushIfSec,
```

Clear errors when updating fields:

```typescript
if (field === "retainBytes") setRetentionError(null);
if (field === "flushIfSec") setFlushError(null);
```

- [ ] **Step 5: Render retention and flush fields**

In the stream settings grid after `Storage Directory`, add:

```tsx
<Grid size={{ xs: 12, md: 4 }}>
  <TextField
    label="Retention Limit"
    value={streams[activeStream].retainBytes}
    onChange={(e) => updateStream(activeStream, "retainBytes", e.target.value)}
    error={retentionError !== null}
    helperText={
      retentionError ??
      "Use 0 for unlimited, or values like 50 GB, 1 TB, 500 MB."
    }
    size="small"
    fullWidth
  />
</Grid>
<Grid size={{ xs: 12, md: 4 }}>
  <TextField
    label="Metadata Flush Interval"
    type="number"
    value={streams[activeStream].flushIfSec}
    onChange={(e) => updateStream(activeStream, "flushIfSec", e.target.value)}
    error={flushError !== null}
    helperText={flushError ?? "Seconds; 120 is recommended for normal recording."}
    size="small"
    fullWidth
    inputProps={{ min: 0, step: 1 }}
  />
</Grid>
<Grid size={{ xs: 12 }}>
  <Alert severity="info">
    Moonfire currently retains recordings by storage quota, not by number of days.
  </Alert>
</Grid>
```

- [ ] **Step 6: Run dialog tests and verify they pass**

Run:

```bash
cd ui && npm test -- Cameras/AddEditDialog.test.tsx --run
```

Expected: PASS.

---

### Task 5: Update Camera Table Status and Retention Summary

**Files:**
- Modify: `ui/src/Settings/CameraConfig.tsx`
- Modify: `ui/src/Settings/CameraConfig.test.tsx`

- [ ] **Step 1: Write failing camera table test**

Add to `ui/src/Settings/CameraConfig.test.tsx`:

```typescript
test("renders recording status and retention summary", async () => {
  vi.mocked(api.getCamerasAdmin).mockResolvedValue({
    status: "success",
    response: {
      cameras: [
        {
          id: 1,
          uuid: "abc-123",
          shortName: "Lobby",
          description: "Main entrance",
          onvifBaseUrl: "http://192.168.1.50/onvif/device_service",
          hasCredentials: false,
          streams: [
            {
              id: 10,
              type: "main",
              mode: "record",
              rtspUrl: "rtsp://camera/main",
              rtspTransport: "tcp",
              sampleFileDirId: 7,
              retainBytes: 50_000_000_000,
              flushIfSec: 120,
            },
          ],
        },
      ],
    },
  } as api.FetchResult<api.GetCamerasAdminResponse>);

  renderWithCtx(<CameraConfig csrf="token" />);

  expect(await screen.findByText("Lobby")).toBeInTheDocument();
  expect(screen.getByText("Waiting for frames")).toBeInTheDocument();
  expect(screen.getByText("main: configured, no frames yet")).toBeInTheDocument();
  expect(screen.getByText("50 GB limit")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run camera config tests and verify they fail**

Run:

```bash
cd ui && npm test -- Settings/CameraConfig.test.tsx --run
```

Expected: FAIL because the table still shows `Resolution` / `Bitrate` placeholders and old status labels.

- [ ] **Step 3: Import new helpers**

In `ui/src/Settings/CameraConfig.tsx`, replace the view model import with:

```typescript
import {
  cameraIp,
  cameraRecordingStatus,
  retentionSummary,
} from "../Cameras/viewModel";
```

- [ ] **Step 4: Update table headers**

Replace the header list:

```typescript
["Camera Name", "IP Address", "Recording Status", "Retention", "Actions"]
```

- [ ] **Step 5: Render recording status and retention**

Inside `cameras.map`, replace `const status = cameraStatus(camera); const online = ...` with:

```typescript
const status = cameraRecordingStatus(camera);
const healthy = status.color === "success";
```

Use `healthy` for `StatusDot online={healthy}` and row background.

Replace the old `Resolution` cell with:

```tsx
<TableCell sx={{ py: 1.25 }}>
  <Stack spacing={0.25}>
    <Typography variant="body2" sx={{ fontWeight: 700 }}>
      {status.label}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {status.detail}
    </Typography>
  </Stack>
</TableCell>
```

Replace the old `Bitrate` cell with:

```tsx
<TableCell sx={{ py: 1.25 }}>
  <Typography variant="body2" color="text.secondary">
    {retentionSummary(camera)}
  </Typography>
</TableCell>
```

Remove the old `OFFLINE` chip or change it to render `status.label` only when `status.color !== "success"`.

- [ ] **Step 6: Run camera config tests and verify they pass**

Run:

```bash
cd ui && npm test -- Settings/CameraConfig.test.tsx --run
```

Expected: PASS.

---

### Task 6: Full Verification

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run targeted backend tests**

Run:

```bash
RUSTFLAGS='--cfg tokio_unstable --cfg tokio_taskdump' /home/ai/.cargo/bin/cargo test --manifest-path server/Cargo.toml --features bundled camera_stream_admin_round_trips_retention_fields -- --nocapture
```

Expected: PASS.

- [ ] **Step 2: Run targeted UI tests**

Run:

```bash
cd ui && npm test -- Cameras/viewModel.test.ts Cameras/AddEditDialog.test.tsx Settings/CameraConfig.test.tsx --run
```

Expected: PASS.

- [ ] **Step 3: Run UI build**

Run:

```bash
cd ui && npm run build
```

Expected: PASS. Existing Vite chunk-size warnings are acceptable if build exits `0`.

- [ ] **Step 4: Run backend build**

Run:

```bash
RUSTFLAGS='--cfg tokio_unstable --cfg tokio_taskdump' /home/ai/.cargo/bin/cargo build --manifest-path server/Cargo.toml --bin moonfire-nvr --features bundled
```

Expected: PASS. Existing `StartStream` unused warning is acceptable if build exits `0`.

- [ ] **Step 5: Manual smoke test**

Restart local backend and open:

```text
http://10.20.0.201:5175/streams#/system
```

Verify:

- Add/Edit Camera shows `Retention Limit` and `Metadata Flush Interval`.
- Saving `50 GB` and `120` sends `retainBytes: 50000000000` and `flushIfSec: 120`.
- Camera table shows `Waiting for frames` rather than `Online` when recording is configured but counters are zero.

