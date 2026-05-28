# Sample File Directory Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend API and web UI support for listing, creating, and selecting Moonfire sample file directories from the Add/Edit Camera dialog.

**Architecture:** Add a small admin API surface under `/api/sample-file-dirs` that wraps existing database sample-file-directory functions. Extend `ui/src/api.ts` with typed helpers, then update `ui/src/Cameras/AddEditDialog.tsx` to fetch directories, replace the raw numeric `Sample File Dir ID` input with a `Storage Directory` dropdown, and provide an inline create-directory form. Keep delete/edit/retention management out of scope.

**Tech Stack:** Rust/Tokio/Hyper/Serde for backend, React 19 + TypeScript + Material UI v7 for frontend, Vitest/Testing Library/MSW for UI tests, Rust tests for path/API coverage, Playwright for rendered QA.

---

## File Structure

- Modify `server/src/web/path.rs`: add `SampleFileDirsAdmin` path decoding for `/api/sample-file-dirs`.
- Modify `server/src/web/mod.rs`: register the new path and module.
- Create `server/src/web/sample_file_dirs.rs`: implement `GET` and `POST` handlers.
- Modify `server/src/json.rs`: add request/response structs for sample file directories.
- Modify `ui/src/api.ts`: add typed sample file directory helpers.
- Modify `ui/src/Cameras/AddEditDialog.tsx`: fetch dirs, show dropdown, inline create form, warnings, and summary text.
- Modify `ui/src/Cameras/AddEditDialog.test.tsx`: cover directory fetching, creation, selection, warning, and save payload.
- Optionally modify `ui/src/Cameras/index.test.tsx` or `ui/src/App.test.tsx` only if newly required API calls need MSW handlers.

---

### Task 1: Backend path and JSON types

**Files:**
- Modify: `server/src/web/path.rs`
- Modify: `server/src/json.rs`

- [ ] **Step 1: Add path enum variant**

In `server/src/web/path.rs`, add this enum variant after `CamerasAdmin`:

```rust
    SampleFileDirsAdmin,                              // GET/POST "/api/sample-file-dirs"
```

- [ ] **Step 2: Decode `/api/sample-file-dirs` before camera paths**

In `Path::decode`, add this branch before `path == "cameras"`:

```rust
        } else if path == "sample-file-dirs" {
            return Path::SampleFileDirsAdmin;
```

The surrounding order should remain:

```rust
        } else if path == "sample-file-dirs" {
            return Path::SampleFileDirsAdmin;
        } else if path == "cameras" {
            return Path::CamerasAdmin;
```

- [ ] **Step 3: Add path tests**

In `server/src/web/path.rs`, inside `camera_admin_paths`, add:

```rust
        assert_eq!(Path::decode("/api/sample-file-dirs"), Path::SampleFileDirsAdmin);
        assert_eq!(Path::decode("/api/sample-file-dirs/"), Path::NotFound);
```

- [ ] **Step 4: Add JSON structs**

In `server/src/json.rs`, after `GetCamerasAdminResponse`, add:

```rust
/// One sample file directory entry in `GET /api/sample-file-dirs`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleFileDirEntry {
    pub id: i32,
    pub path: String,
}

/// Response body for `GET /api/sample-file-dirs`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSampleFileDirsResponse {
    pub sample_file_dirs: Vec<SampleFileDirEntry>,
}

/// Request body for `POST /api/sample-file-dirs`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostSampleFileDirRequest {
    pub csrf: Option<String>,
    pub path: std::path::PathBuf,
}

/// Response body for `POST /api/sample-file-dirs`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostSampleFileDirResponse {
    pub id: i32,
}
```

- [ ] **Step 5: Run path test and verify failure surface is only missing variant/compile until handlers are added**

Run:

```bash
cargo test -p moonfire-nvr web::path::tests::camera_admin_paths
```

Expected after Task 1 code compiles: PASS for path tests. If the full crate compile fails because `Path::SampleFileDirsAdmin` is not yet handled in `serve_inner`, proceed to Task 2 before final backend verification.

- [ ] **Step 6: Commit Task 1**

```bash
git add server/src/web/path.rs server/src/json.rs
git commit -m "feat(api): define sample file directory admin types"
```

---

### Task 2: Backend sample file directory API handlers

**Files:**
- Create: `server/src/web/sample_file_dirs.rs`
- Modify: `server/src/web/mod.rs`

- [ ] **Step 1: Create handler module**

Create `server/src/web/sample_file_dirs.rs` with:

```rust
// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

use crate::{
    json,
    web::{
        into_json_body, parse_json_body, plain_response, require_csrf_if_session, serve_json,
        Caller, ResponseResult, Service,
    },
};
use base::bail;
use http::{Method, Request, StatusCode};
use std::sync::Arc;

impl Service {
    pub(super) async fn sample_file_dirs(
        self: Arc<Self>,
        req: Request<hyper::body::Incoming>,
        caller: Caller,
    ) -> ResponseResult {
        match *req.method() {
            Method::GET | Method::HEAD => self.get_sample_file_dirs(req, caller).await,
            Method::POST => self.post_sample_file_dir(req, caller).await,
            _ => Ok(plain_response(
                StatusCode::METHOD_NOT_ALLOWED,
                "GET, HEAD, or POST expected",
            )),
        }
    }

    async fn get_sample_file_dirs(
        &self,
        req: Request<hyper::body::Incoming>,
        caller: Caller,
    ) -> ResponseResult {
        if !(caller.permissions.read_camera_configs || caller.permissions.admin_users) {
            bail!(Unauthenticated, msg("must have read_camera_configs permission"));
        }
        let l = self.db.lock();
        let sample_file_dirs = l
            .sample_file_dirs_by_id()
            .iter()
            .map(|(&id, dir)| json::SampleFileDirEntry {
                id,
                path: dir.pool().path().display().to_string(),
            })
            .collect();
        serve_json(&req, &json::GetSampleFileDirsResponse { sample_file_dirs })
    }

    async fn post_sample_file_dir(
        self: Arc<Self>,
        req: Request<hyper::body::Incoming>,
        caller: Caller,
    ) -> ResponseResult {
        if !caller.permissions.admin_users {
            bail!(Unauthenticated, msg("must have admin_users permission"));
        }
        let (parts, b) = into_json_body(req).await?;
        let r: json::PostSampleFileDirRequest = parse_json_body(&b)?;
        require_csrf_if_session(&caller, r.csrf.as_deref())?;
        let id = self.db.add_sample_file_dir(r.path).await?;
        serve_json(&parts, &json::PostSampleFileDirResponse { id })
    }
}
```

- [ ] **Step 2: Register module and route**

In `server/src/web/mod.rs`, add near other modules:

```rust
mod sample_file_dirs;
```

In `serve_inner`, add a `Path::SampleFileDirsAdmin` arm after `Path::CamerasAdmin`:

```rust
            Path::SampleFileDirsAdmin => (
                CacheControl::PrivateDynamic,
                Arc::clone(&self).sample_file_dirs(req, caller).await?,
            ),
```

- [ ] **Step 3: Run backend tests**

Run:

```bash
cargo test -p moonfire-nvr web::path::tests::camera_admin_paths
cargo test -p moonfire-nvr web::tests
```

Expected: PASS. If `dir.pool().path()` does not compile, inspect `server/db/dir/mod.rs` and use the existing pool path accessor name exposed there.

- [ ] **Step 4: Commit Task 2**

```bash
git add server/src/web/mod.rs server/src/web/sample_file_dirs.rs
git commit -m "feat(api): add sample file directory admin endpoint"
```

---

### Task 3: Frontend API helpers and test fixtures

**Files:**
- Modify: `ui/src/api.ts`
- Modify: `ui/src/Cameras/AddEditDialog.test.tsx`

- [ ] **Step 1: Add TypeScript API types and helpers**

In `ui/src/api.ts`, after `GetCamerasAdminResponse`, add:

```ts
export interface SampleFileDirEntry {
  id: number;
  path: string;
}

export interface GetSampleFileDirsResponse {
  sampleFileDirs: SampleFileDirEntry[];
}

export interface PostSampleFileDirRequest {
  csrf?: string;
  path: string;
}

export interface PostSampleFileDirResponse {
  id: number;
}

export async function getSampleFileDirs(init: RequestInit) {
  return await json<GetSampleFileDirsResponse>("/api/sample-file-dirs", init);
}

export async function createSampleFileDir(
  req: PostSampleFileDirRequest,
  init: RequestInit,
) {
  return await json<PostSampleFileDirResponse>("/api/sample-file-dirs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    ...init,
  });
}
```

- [ ] **Step 2: Add default MSW handlers to dialog tests**

In `ui/src/Cameras/AddEditDialog.test.tsx`, update `afterEach` to restore default handlers by replacing it with:

```ts
afterEach(() => {
  server.resetHandlers();
});
```

Then add this helper after `renderAddDialog`:

```tsx
function mockSampleFileDirs(
  sampleFileDirs = [{ id: 7, path: "/var/lib/moonfire-nvr/sample" }],
) {
  server.use(
    http.get("/api/sample-file-dirs", () =>
      HttpResponse.json({ sampleFileDirs }),
    ),
  );
}
```

- [ ] **Step 3: Update existing dialog tests to call `mockSampleFileDirs()` before render**

At the start of every existing test in `AddEditDialog.test.tsx`, before `renderAddDialog()` or rendering `AddEditDialog`, add:

```ts
  mockSampleFileDirs();
```

For the save test, keep the existing `server.use(...)` camera handlers and add the sample dirs handler before render.

- [ ] **Step 4: Run dialog tests and verify they still pass after API helper changes**

Run:

```bash
npm --prefix ui test -- Cameras/AddEditDialog.test.tsx --run
```

Expected: Tests may fail until Task 4 implements the actual fetch, but TypeScript should recognize the API helpers.

- [ ] **Step 5: Commit Task 3**

```bash
git add ui/src/api.ts ui/src/Cameras/AddEditDialog.test.tsx
git commit -m "feat(ui): add sample file directory api helpers"
```

---

### Task 4: Frontend tests for storage directory UX

**Files:**
- Modify: `ui/src/Cameras/AddEditDialog.test.tsx`

- [ ] **Step 1: Add test for fetched options and record warning**

Add this test before the save test:

```tsx
test("shows storage directory options and warns when recording has none", async () => {
  const user = userEvent.setup();
  mockSampleFileDirs([
    { id: 7, path: "/var/lib/moonfire-nvr/sample" },
    { id: 8, path: "/media/nvr/sample" },
  ]);
  renderAddDialog();

  await screen.findByText("Storage Directory");
  await user.click(screen.getByLabelText("Mode"));
  await user.click(screen.getByRole("option", { name: "Record" }));

  expect(screen.getByText("Recording requires a storage directory. Create or select one before saving."))
    .toBeInTheDocument();
  expect(within(screen.getByTestId("stream-summary-main")).getByText("Storage dir missing"))
    .toBeInTheDocument();

  await user.click(screen.getByLabelText("Storage Directory"));
  expect(screen.getByRole("option", { name: "Dir 7 — /var/lib/moonfire-nvr/sample" }))
    .toBeInTheDocument();
  await user.click(screen.getByRole("option", { name: "Dir 8 — /media/nvr/sample" }));

  expect(screen.queryByText("Recording requires a storage directory. Create or select one before saving."))
    .not.toBeInTheDocument();
  expect(within(screen.getByTestId("stream-summary-main")).getByText("Dir 8"))
    .toBeInTheDocument();
});
```

- [ ] **Step 2: Add test for inline create flow**

Add this test after the options/warning test:

```tsx
test("creates a storage directory and selects it for the active stream", async () => {
  const user = userEvent.setup();
  let createBody: any = null;
  mockSampleFileDirs([]);
  server.use(
    http.post("/api/sample-file-dirs", async ({ request }) => {
      createBody = await request.json();
      return HttpResponse.json({ id: 9 });
    }),
    http.get("/api/sample-file-dirs", () =>
      HttpResponse.json({
        sampleFileDirs: [{ id: 9, path: "/tmp/moonfire-sample" }],
      }),
    ),
  );

  renderAddDialog();

  await user.click(await screen.findByRole("button", { name: "Create directory" }));
  await user.type(screen.getByLabelText("Directory path"), "/tmp/moonfire-sample");
  await user.click(screen.getByRole("button", { name: "Create" }));

  await screen.findByText("Storage directory Dir 9 created");
  expect(createBody).toMatchObject({ csrf: "csrf-token", path: "/tmp/moonfire-sample" });
  expect(screen.getByLabelText("Storage Directory")).toHaveTextContent("Dir 9");
  expect(within(screen.getByTestId("stream-summary-main")).getByText("Dir 9"))
    .toBeInTheDocument();
});
```

- [ ] **Step 3: Update save test expectation**

In `creates camera then saves configured main stream`, after selecting Record and typing RTSP URL, select a storage directory:

```tsx
  await user.click(screen.getByLabelText("Storage Directory"));
  await user.click(screen.getByRole("option", { name: "Dir 7 — /var/lib/moonfire-nvr/sample" }));
```

Update final stream body assertion to include:

```ts
    sampleFileDirId: 7,
```

- [ ] **Step 4: Run tests and verify they fail before UI implementation**

Run:

```bash
npm --prefix ui test -- Cameras/AddEditDialog.test.tsx --run
```

Expected: FAIL because the `Storage Directory` select, warning, and create directory UI are not implemented yet.

- [ ] **Step 5: Commit failing frontend tests**

```bash
git add ui/src/Cameras/AddEditDialog.test.tsx
git commit -m "test: specify sample file directory dialog ux"
```

---

### Task 5: Implement Add/Edit dialog storage directory UI

**Files:**
- Modify: `ui/src/Cameras/AddEditDialog.tsx`

- [ ] **Step 1: Extend imports**

Add MUI imports if missing:

```tsx
import Alert from "@mui/material/Alert";
```

Ensure `api` and `useSnackbars` are already available.

- [ ] **Step 2: Add state for sample directories and create form**

Inside `AddEditDialog`, after stream/saving state, add:

```tsx
  const [sampleFileDirs, setSampleFileDirs] = useState<api.SampleFileDirEntry[]>([]);
  const [loadingSampleFileDirs, setLoadingSampleFileDirs] = useState(false);
  const [createDirOpen, setCreateDirOpen] = useState(false);
  const [newDirPath, setNewDirPath] = useState("");
  const [creatingDir, setCreatingDir] = useState(false);
```

- [ ] **Step 3: Add fetch helper**

Inside `AddEditDialog`, before `useEffect`, add:

```tsx
  const fetchSampleFileDirs = async () => {
    setLoadingSampleFileDirs(true);
    try {
      const resp = await api.getSampleFileDirs({});
      if (resp.status === "success") {
        setSampleFileDirs(resp.response.sampleFileDirs);
      } else if (resp.status === "error") {
        snackbars.enqueue({ message: "Failed to load storage directories: " + resp.message });
      }
    } finally {
      setLoadingSampleFileDirs(false);
    }
  };
```

- [ ] **Step 4: Fetch directories when dialog opens**

In the existing `useEffect(() => { if (!open) return; ... }, [open, camera]);`, add after `if (!open) return;`:

```tsx
    fetchSampleFileDirs();
```

If ESLint asks for dependencies, wrap `fetchSampleFileDirs` in `useCallback` with `[snackbars]` and add it to the dependency list.

- [ ] **Step 5: Add create directory handler**

Inside `AddEditDialog`, before `handleSave`, add:

```tsx
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
        snackbars.enqueue({ message: "Create storage directory failed: " + resp.message });
      }
    } finally {
      setCreatingDir(false);
    }
  };
```

- [ ] **Step 6: Update summary card props and text**

Change `StreamSummaryCard` props to include:

```tsx
  sampleFileDirs: api.SampleFileDirEntry[];
```

Inside the component, derive storage text:

```tsx
  const dir = stream.sampleFileDirId
    ? sampleFileDirs.find((d) => d.id.toString() === stream.sampleFileDirId)
    : undefined;
  const storageLabel = stream.sampleFileDirId
    ? `Dir ${stream.sampleFileDirId}`
    : stream.mode === "record"
      ? "Storage dir missing"
      : "No storage directory";
```

Render `storageLabel` as a fourth line under transport:

```tsx
        <Typography sx={{ fontSize: 11, lineHeight: "14px" }} color={stream.mode === "record" && !stream.sampleFileDirId ? "warning.main" : "text.secondary"}>
          {dir ? `Dir ${dir.id}` : storageLabel}
        </Typography>
```

Pass `sampleFileDirs={sampleFileDirs}` where `StreamSummaryCard` is rendered.

- [ ] **Step 7: Replace numeric field with Storage Directory select**

Replace the `TextField` with label `Sample File Dir ID` with this block:

```tsx
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
                        updateStream(activeStream, "sampleFileDirId", e.target.value)
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
                  <Typography sx={{ fontSize: 11, lineHeight: "16px", mt: 0.5 }} color="text.secondary">
                    {sampleFileDirs.length === 0
                      ? "No storage directories configured yet. Create one here or with moonfire-nvr config → Directories and retention."
                      : "Choose where recordings for this stream are stored."}
                  </Typography>
                  {streams[activeStream].mode === "record" &&
                    !streams[activeStream].sampleFileDirId && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Recording requires a storage directory. Create or select one before saving.
                      </Alert>
                    )}
```

- [ ] **Step 8: Add create directory inline form after the storage select grid row**

After the storage directory grid item, add:

```tsx
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
```

- [ ] **Step 9: Run dialog tests**

Run:

```bash
npm --prefix ui test -- Cameras/AddEditDialog.test.tsx --run
```

Expected: PASS.

- [ ] **Step 10: Commit Task 5**

```bash
git add ui/src/Cameras/AddEditDialog.tsx ui/src/Cameras/AddEditDialog.test.tsx
git commit -m "feat(ui): manage storage directory selection in camera dialog"
```

---

### Task 6: Integration verification and Playwright QA

**Files:**
- No source changes expected unless verification finds a bug.

- [ ] **Step 1: Run backend focused tests**

Run:

```bash
cargo test -p moonfire-nvr web::path::tests::camera_admin_paths
cargo test -p moonfire-nvr web::tests
```

Expected: PASS.

- [ ] **Step 2: Run frontend tests**

Run:

```bash
npm --prefix ui test -- Cameras/AddEditDialog.test.tsx --run
npm --prefix ui test -- --run
```

Expected: PASS.

- [ ] **Step 3: Run UI build**

Run:

```bash
npm --prefix ui run build
```

Expected: PASS. Existing Vite chunk-size warnings are acceptable.

- [ ] **Step 4: Run rendered Playwright QA**

Start or reuse Vite on port 5175:

```bash
npm --prefix ui run dev -- --host 0.0.0.0 --port 5175
```

Use a temporary Playwright script outside the repo to mock:

- `GET /api/?days=true`
- `GET /api/cameras`
- `GET /api/sample-file-dirs`
- `POST /api/sample-file-dirs`
- camera create/update stream endpoints

Verify:

1. `/cameras` loads.
2. Add Camera opens.
3. `Storage Directory` select is visible.
4. `Create directory` creates `Dir 9 — /tmp/moonfire-sample`.
5. `Mode = Record` with no directory shows warning.
6. Selecting/creating a directory removes warning.
7. Save payload includes `sampleFileDirId: 9`.
8. Desktop and mobile screenshots have no horizontal overflow.

- [ ] **Step 5: Commit any verification fixes**

If verification required code fixes, commit them with a focused message. If no changes are needed, do not create a commit.

- [ ] **Step 6: Push branch**

Run:

```bash
git push -u origin add-camera-command-dialog
```
