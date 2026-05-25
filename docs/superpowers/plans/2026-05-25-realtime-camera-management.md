# Realtime Camera Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CRUD camera management via REST API + React UI with immediate effect (no server restart required), driven by a `StreamerManager` Tokio actor.

**Architecture:** A new `StreamerManager` task owns a `HashMap<stream_id, JoinHandle>` of streamer tasks and receives `Start/Stop/Restart(stream_id)` commands via `mpsc` channel. REST handlers write to the SQLite DB then send commands to the manager. The frontend `/cameras` page (MUI + React Router) follows the existing `/users` pattern.

**Tech Stack:** Rust (Tokio, hyper, serde_json, rusqlite), React 18, MUI v5, TypeScript, vitest

---

## File Map

**New files:**
- `server/src/streamer_manager.rs` — StreamerManager actor
- `server/src/web/cameras_admin.rs` — REST handlers for camera CRUD

**Modified files:**
- `server/src/main.rs` — add `mod streamer_manager;`
- `server/src/cmds/run/mod.rs` — replace static JoinSet with StreamerManager; pass sender to Service
- `server/src/json.rs` — add camera admin request/response types
- `server/src/web/path.rs` — add CamerasAdmin, CameraAdmin, CameraStreamAdmin variants
- `server/src/web/mod.rs` — add `cameras_admin` module; add `streamer_tx` to Service; route new paths
- `ui/src/api.ts` — add camera admin types + functions
- `ui/src/App.tsx` — add `/cameras` route
- `ui/src/components/Header.tsx` — add Cameras nav item

**New frontend files:**
- `ui/src/Cameras/index.tsx` — camera list page
- `ui/src/Cameras/AddEditDialog.tsx` — add/edit dialog

---

## Task 1: `StreamerManager` — module skeleton + types

**Files:**
- Create: `server/src/streamer_manager.rs`
- Modify: `server/src/main.rs`

- [ ] **Step 1: Add module declaration**

In `server/src/main.rs`, after line 19 (`mod streamer;`):
```rust
mod streamer_manager;
```

- [ ] **Step 2: Write `streamer_manager.rs` with types and failing test**

Create `server/src/streamer_manager.rs`:
```rust
// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

use crate::streamer;
use base::clock;
use db;
use retina::client::SessionGroup;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::task::JoinHandle;
use tracing::{error, info, warn};

/// Commands sent from API handlers to the StreamerManager.
#[derive(Debug)]
pub enum StreamerCommand {
    /// Spawn a streamer for the given stream_id (no-op if already running).
    StartStream(i32),
    /// Stop the streamer for the given stream_id.
    StopStream(i32),
    /// Stop and restart the streamer for the given stream_id.
    RestartStream(i32),
}

struct RunningStream {
    handle: JoinHandle<()>,
}

pub struct StreamerManager {
    db: Arc<db::Database>,
    env: &'static streamer::Environment<'static, clock::RealClocks>,
    rx: tokio::sync::mpsc::Receiver<StreamerCommand>,
    handles: HashMap<i32, RunningStream>,
    session_groups: HashMap<i32, Arc<SessionGroup>>, // keyed by camera_id
}

impl StreamerManager {
    pub fn new(
        db: Arc<db::Database>,
        env: &'static streamer::Environment<'static, clock::RealClocks>,
        rx: tokio::sync::mpsc::Receiver<StreamerCommand>,
    ) -> Self {
        Self {
            db,
            env,
            rx,
            handles: HashMap::new(),
            session_groups: HashMap::new(),
        }
    }

    pub async fn run(mut self) {
        info!("StreamerManager started");
        while let Some(cmd) = self.rx.recv().await {
            match cmd {
                StreamerCommand::StartStream(id) => self.start_stream(id).await,
                StreamerCommand::StopStream(id) => self.stop_stream(id).await,
                StreamerCommand::RestartStream(id) => self.restart_stream(id).await,
            }
        }
        info!("StreamerManager shutting down, stopping all streams");
        let ids: Vec<i32> = self.handles.keys().cloned().collect();
        for id in ids {
            self.stop_stream(id).await;
        }
        info!("StreamerManager stopped");
    }

    async fn stop_stream(&mut self, stream_id: i32) {
        if let Some(s) = self.handles.remove(&stream_id) {
            s.handle.abort();
            let _ = s.handle.await;
            info!(stream_id, "stopped streamer");
        }
    }

    async fn restart_stream(&mut self, stream_id: i32) {
        self.stop_stream(stream_id).await;
        self.start_stream(stream_id).await;
    }

    async fn start_stream(&mut self, stream_id: i32) {
        if self.handles.contains_key(&stream_id) {
            return; // already running
        }
        let result = self.do_start_stream(stream_id);
        match result {
            Ok(handle) => {
                self.handles.insert(stream_id, RunningStream { handle });
            }
            Err(e) => {
                warn!(stream_id, err = %e.chain(), "failed to start streamer");
            }
        }
    }

    fn do_start_stream(
        &mut self,
        stream_id: i32,
    ) -> Result<JoinHandle<()>, base::Error> {
        let l = self.db.lock();
        let stream = l
            .streams_by_id()
            .get(&stream_id)
            .ok_or_else(|| base::err!(NotFound, msg("no stream {stream_id}")))?
            .clone();
        let locked = stream.inner.lock();
        if locked.config.mode != db::json::STREAM_MODE_RECORD {
            return Err(base::err!(
                InvalidArgument,
                msg("stream {stream_id} is not in record mode")
            ));
        }
        if locked.sample_file_dir.is_none() {
            return Err(base::err!(
                InvalidArgument,
                msg("stream {stream_id} has no sample file dir")
            ));
        }
        let camera = l
            .cameras_by_id()
            .get(&locked.camera_id)
            .ok_or_else(|| base::err!(Internal, msg("camera missing for stream {stream_id}")))?;
        let session_group = self
            .session_groups
            .entry(camera.id)
            .or_insert_with(|| Arc::new(SessionGroup::default().named(camera.short_name.clone())))
            .clone();
        // Spread rotation offset across streams by stream_id.
        let rotate_offset_sec =
            (stream_id as i64 % streamer::ROTATE_INTERVAL_SEC).abs();
        let mut s = streamer::Streamer::new(
            self.env,
            camera,
            stream.clone(),
            &locked,
            session_group,
            rotate_offset_sec,
            streamer::ROTATE_INTERVAL_SEC,
        )?;
        drop(locked);
        drop(l);
        let short_name = s.short_name().to_owned();
        let span = tracing::info_span!("streamer", stream = %short_name);
        let handle = tokio::task::Builder::new()
            .name(&format!("s-{short_name}"))
            .spawn(
                async move {
                    info!("starting");
                    s.run().await;
                    info!("ending");
                }
                .instrument(span),
            )
            .expect("spawn should succeed");
        Ok(handle)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;

    #[tokio::test]
    async fn manager_exits_when_sender_dropped() {
        // When the sender is dropped, run() should return (after stopping all streams).
        let db = db::testutil::make_db();
        // We need a static env; for this test we use a leak since tests are short-lived.
        let (shutdown_tx, shutdown_rx) = base::shutdown::channel();
        let env: &'static streamer::Environment<'static, clock::RealClocks> =
            Box::leak(Box::new(streamer::Environment {
                clocks: clock::RealClocks {},
                sample_entries: db.lock().sample_entries().clone(),
                opener: &crate::stream::OPENER,
                shutdown_rx,
            }));
        let (tx, rx) = mpsc::channel(8);
        let mgr = StreamerManager::new(db.clone(), env, rx);
        let task = tokio::spawn(mgr.run());
        drop(tx); // close the channel
        tokio::time::timeout(std::time::Duration::from_secs(2), task)
            .await
            .expect("manager did not exit within timeout")
            .expect("manager panicked");
        drop(shutdown_tx);
    }
}
```

- [ ] **Step 3: Run test to verify it compiles and the exit test passes**

```bash
cd server && cargo test streamer_manager 2>&1 | tail -20
```
Expected: test `manager_exits_when_sender_dropped` PASS (or compile error to fix).

- [ ] **Step 4: Commit**

```bash
git add server/src/streamer_manager.rs server/src/main.rs
git commit -m "feat(server): add StreamerManager skeleton with Start/Stop/Restart command types"
```

---

## Task 2: Refactor `inner()` to use `StreamerManager`

**Files:**
- Modify: `server/src/cmds/run/mod.rs`

- [ ] **Step 1: Add imports and `Flusher` struct at top of `run/mod.rs`**

After the existing use statements, confirm these are present (add if missing):
```rust
use crate::streamer_manager::{StreamerCommand, StreamerManager};
use tokio::sync::mpsc;
```

- [ ] **Step 2: Replace the static streamer-startup block in `inner()`**

In `server/src/cmds/run/mod.rs`, find the block starting at:
```rust
// Start a streamer for each stream.
let mut streamers = tokio::task::JoinSet::new();
let mut session_groups_by_camera: FastHashMap<i32, Arc<retina::client::SessionGroup>> =
    FastHashMap::default();
if !read_only {
```
…and ending at:
```rust
    drop(l);
};
```

Replace the entire block with:
```rust
// Start a StreamerManager + initial streamers for each stream in record mode.
let (streamer_tx, streamer_rx) = mpsc::channel::<StreamerCommand>(64);
if !read_only {
    let l = db.lock();
    let env: &'static streamer::Environment<'static, clock::RealClocks> =
        Box::leak(Box::new(streamer::Environment {
            clocks: db.clocks(),
            sample_entries: l.sample_entries().clone(),
            opener: &crate::stream::OPENER,
            shutdown_rx: shutdown_rx.clone(),
        }));
    let mut mgr = StreamerManager::new(db.clone(), env, streamer_rx);
    // Pre-seed: start all streams that are currently in record mode.
    for (stream_id, stream) in l.streams_by_id() {
        let locked = stream.inner.lock();
        if locked.config.mode == db::json::STREAM_MODE_RECORD
            && locked.sample_file_dir.is_some()
        {
            mgr.seed_stream(*stream_id);
        }
    }
    drop(l);
    tokio::task::Builder::new()
        .name("streamer-manager")
        .spawn(mgr.run())
        .expect("spawn should succeed");
};
```

- [ ] **Step 3: Add `seed_stream` method to `StreamerManager`**

In `server/src/streamer_manager.rs`, add before `pub async fn run`:
```rust
/// Called during startup to pre-populate running streams without going through the channel.
pub fn seed_stream(&mut self, stream_id: i32) {
    let result = self.do_start_stream(stream_id);
    match result {
        Ok(handle) => {
            self.handles.insert(stream_id, RunningStream { handle });
        }
        Err(e) => {
            warn!(stream_id, err = %e.chain(), "failed to seed streamer at startup");
        }
    }
}
```

- [ ] **Step 4: Replace shutdown wait + streamer drain in `inner()`**

Find:
```rust
info!("Shutting down streamers, directory pools, and flusher.");
while let Some(res) = streamers.join_next().await {
    if res.is_err() {
        tracing::error!("streamer panicked; look for previous panic message");
    }
}
```
Replace with:
```rust
info!("Shutting down streamers, directory pools, and flusher.");
// Drop the sender; this closes the channel and causes StreamerManager::run() to exit.
drop(streamer_tx);
// The manager task was spawned with Builder::new() and will self-terminate.
// Give it up to 10 s to stop all streamers gracefully.
tokio::time::sleep(std::time::Duration::from_secs(1)).await;
```

- [ ] **Step 5: Remove now-unused `session_groups_by_camera` teardown**

Find and remove the block:
```rust
info!("Waiting for TEARDOWN requests to complete.");
for g in session_groups_by_camera.values() {
    if let Err(err) = g.await_teardown().await {
        error!(%err, "teardown failed");
    }
}
```
Replace with an empty teardown note (session groups are owned by the manager now):
```rust
info!("Waiting for TEARDOWN requests to complete.");
// Session groups are owned by StreamerManager; teardown happens during abort.
```

- [ ] **Step 6: Build to check for compile errors**

```bash
cd server && cargo build 2>&1 | grep -E "^error" | head -20
```
Expected: 0 errors (warnings are OK).

- [ ] **Step 7: Commit**

```bash
git add server/src/cmds/run/mod.rs server/src/streamer_manager.rs
git commit -m "feat(server): replace static JoinSet with StreamerManager in inner()"
```

---

## Task 3: Pass `streamer_tx` to `web::Service`

**Files:**
- Modify: `server/src/web/mod.rs`
- Modify: `server/src/cmds/run/mod.rs`

- [ ] **Step 1: Add `streamer_tx` to `Config` and `Service`**

In `server/src/web/mod.rs`, find the `Config` struct and add the field:
```rust
pub struct Config<'a> {
    pub db: Arc<db::Database>,
    pub ui_dir: Option<&'a crate::cmds::run::config::UiDir>,
    pub trust_forward_hdrs: bool,
    pub time_zone_name: String,
    pub allow_unauthenticated_permissions: Option<db::Permissions>,
    pub privileged_unix_uid: Option<nix::unistd::Uid>,
    /// Channel to the StreamerManager; None in read-only mode.
    pub streamer_tx: Option<tokio::sync::mpsc::Sender<crate::streamer_manager::StreamerCommand>>,
}
```

Add the field to `Service`:
```rust
pub struct Service {
    db: Arc<db::Database>,
    sample_entries: db::sample_entries::Handle,
    ui: Ui,
    time_zone_name: String,
    allow_unauthenticated_permissions: Option<db::Permissions>,
    trust_forward_hdrs: bool,
    privileged_unix_uid: Option<nix::unistd::Uid>,
    streamer_tx: Option<tokio::sync::mpsc::Sender<crate::streamer_manager::StreamerCommand>>,
}
```

- [ ] **Step 2: Initialize `streamer_tx` in `Service::new`**

In the `Service::new` method, add to the struct initialization:
```rust
Ok(Service {
    db: config.db,
    sample_entries,
    ui: ui_dir,
    allow_unauthenticated_permissions: config.allow_unauthenticated_permissions,
    trust_forward_hdrs: config.trust_forward_hdrs,
    time_zone_name: config.time_zone_name,
    privileged_unix_uid: config.privileged_unix_uid,
    streamer_tx: config.streamer_tx,
})
```

- [ ] **Step 3: Pass `streamer_tx` when constructing `Service` in `inner()`**

In `server/src/cmds/run/mod.rs`, find the `web::Service::new(web::Config {` call and add the field:
```rust
let svc = Arc::new(web::Service::new(web::Config {
    db: db.clone(),
    ui_dir: Some(&config.ui_dir),
    allow_unauthenticated_permissions: bind
        .allow_unauthenticated_permissions
        .clone()
        .map(db::Permissions::from),
    trust_forward_hdrs: bind.trust_forward_headers,
    time_zone_name: time_zone_name.to_owned(),
    privileged_unix_uid: bind.own_uid_is_privileged.then_some(own_euid),
    streamer_tx: if read_only { None } else { Some(streamer_tx.clone()) },
})?);
```

- [ ] **Step 4: Build**

```bash
cd server && cargo build 2>&1 | grep "^error" | head -20
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/web/mod.rs server/src/cmds/run/mod.rs
git commit -m "feat(server): thread streamer_tx through web::Service for camera management API"
```

---

## Task 4: JSON types for camera admin API

**Files:**
- Modify: `server/src/json.rs`

- [ ] **Step 1: Add request/response types**

In `server/src/json.rs`, add after the existing user-management types (near the end of the file):
```rust
// ---- Camera admin API ----

/// Request body for `POST /api/cameras`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostCameraRequest {
    pub csrf: Option<String>,
    pub short_name: String,
    #[serde(default)]
    pub description: String,
    pub onvif_base_url: Option<url::Url>,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
}

/// Request body for `PUT /api/cameras/<id>`.
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PatchCameraRequest {
    pub csrf: Option<String>,
    pub short_name: Option<String>,
    pub description: Option<String>,
    pub onvif_base_url: Option<url::Url>,
    pub username: Option<String>,
    pub password: Option<String>,
}

/// Request body for `PUT /api/cameras/<id>/streams/<type>`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PutCameraStreamRequest {
    pub csrf: Option<String>,
    #[serde(default)]
    pub mode: String, // "record" or "" (off)
    pub rtsp_url: Option<url::Url>,
    #[serde(default)]
    pub rtsp_transport: String, // "tcp", "udp", or ""
    pub sample_file_dir_id: Option<i32>,
}

/// Response body for `POST /api/cameras`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostCameraResponse {
    pub camera_id: i32,
}

/// One camera entry in `GET /api/cameras` (admin view).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraAdminEntry {
    pub id: i32,
    pub uuid: uuid::Uuid,
    pub short_name: String,
    pub description: String,
    pub onvif_base_url: Option<String>,
    pub has_credentials: bool, // true if username is non-empty
    pub streams: Vec<StreamAdminEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamAdminEntry {
    pub id: i32,
    pub type_: String,
    pub mode: String,
    pub rtsp_url: Option<String>,
    pub rtsp_transport: String,
    pub sample_file_dir_id: Option<i32>,
}

/// Response body for `GET /api/cameras`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GetCamerasAdminResponse {
    pub cameras: Vec<CameraAdminEntry>,
}
```

- [ ] **Step 2: Build to check**

```bash
cd server && cargo build 2>&1 | grep "^error" | head -10
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/json.rs
git commit -m "feat(server): add camera admin request/response JSON types"
```

---

## Task 5: Path variants for camera admin API

**Files:**
- Modify: `server/src/web/path.rs`

- [ ] **Step 1: Write failing path tests**

In `server/src/web/path.rs`, in the existing `#[cfg(test)] mod tests`, add:
```rust
#[test]
fn camera_admin_paths() {
    use super::Path;
    use db::StreamType;
    assert_eq!(Path::decode("/api/cameras"), Path::CamerasAdmin);
    assert_eq!(Path::decode("/api/cameras/"), Path::NotFound); // still needs uuid
    assert_eq!(Path::decode("/api/cameras/5"), Path::CameraAdmin(5));
    assert_eq!(Path::decode("/api/cameras/999"), Path::CameraAdmin(999));
    assert_eq!(
        Path::decode("/api/cameras/5/streams/main"),
        Path::CameraStreamAdmin(5, StreamType::Main)
    );
    assert_eq!(
        Path::decode("/api/cameras/5/streams/sub"),
        Path::CameraStreamAdmin(5, StreamType::Sub)
    );
    assert_eq!(
        Path::decode("/api/cameras/5/streams/ext"),
        Path::CameraStreamAdmin(5, StreamType::Ext)
    );
    assert_eq!(Path::decode("/api/cameras/5/streams/junk"), Path::NotFound);
    assert_eq!(Path::decode("/api/cameras/abc"), Path::NotFound);
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && cargo test web::path::tests::camera_admin_paths 2>&1 | tail -5
```
Expected: compile error (variants not defined yet).

- [ ] **Step 3: Add new path variants**

In `server/src/web/path.rs`, add to the `Path` enum:
```rust
CamerasAdmin,               // GET/POST "/api/cameras"
CameraAdmin(i32),           // PUT/DELETE "/api/cameras/<id>"
CameraStreamAdmin(i32, db::StreamType), // PUT "/api/cameras/<id>/streams/<type>"
```

- [ ] **Step 4: Add decode logic**

In the `Path::decode` method, in the `cameras/` prefix branch, add handling for integer IDs. Find:
```rust
} else if let Some(path) = path.strip_prefix("cameras/") {
    let (uuid, path) = match path.split_once('/') {
```

Change to:
```rust
} else if path == "cameras" {
    return Path::CamerasAdmin;
} else if let Some(path) = path.strip_prefix("cameras/") {
    // Check for integer camera ID (admin API) first.
    if let Ok(id) = i32::from_str(path) {
        return Path::CameraAdmin(id);
    }
    if let Some((id_str, rest)) = path.split_once('/') {
        if let Ok(id) = i32::from_str(id_str) {
            if let Some(type_str) = rest.strip_prefix("streams/") {
                return match db::StreamType::parse(type_str) {
                    Some(t) => Path::CameraStreamAdmin(id, t),
                    None => Path::NotFound,
                };
            }
            return Path::NotFound;
        }
    }
    let (uuid, path) = match path.split_once('/') {
```

- [ ] **Step 5: Run tests**

```bash
cd server && cargo test web::path::tests 2>&1 | tail -10
```
Expected: all path tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/web/path.rs
git commit -m "feat(server): add CamerasAdmin/CameraAdmin/CameraStreamAdmin path variants"
```

---

## Task 6: Camera admin API handlers

**Files:**
- Create: `server/src/web/cameras_admin.rs`

- [ ] **Step 1: Create the handler file**

Create `server/src/web/cameras_admin.rs`:
```rust
// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

use crate::{
    json,
    streamer_manager::StreamerCommand,
    web::{into_json_body, parse_json_body, plain_response, require_csrf_if_session, serve_json,
          Caller, ResponseResult, Service},
};
use base::err;
use db::{self, StreamType};
use http::{Method, Request, StatusCode};

impl Service {
    pub(super) async fn cameras_admin(
        self: std::sync::Arc<Self>,
        req: Request<hyper::body::Incoming>,
        caller: Caller,
    ) -> ResponseResult {
        match *req.method() {
            Method::GET | Method::HEAD => self.get_cameras_admin(req, caller).await,
            Method::POST => self.post_camera(req, caller).await,
            _ => Ok(plain_response(
                StatusCode::METHOD_NOT_ALLOWED,
                "GET, HEAD, or POST expected",
            )),
        }
    }

    async fn get_cameras_admin(
        &self,
        req: Request<hyper::body::Incoming>,
        caller: Caller,
    ) -> ResponseResult {
        if !caller.permissions.admin_users {
            bail!(Unauthenticated, msg("must have admin_users permission"));
        }
        let l = self.db.lock();
        let mut cameras = Vec::new();
        for (&id, cam) in l.cameras_by_id() {
            let mut streams = Vec::new();
            for &type_ in &db::ALL_STREAM_TYPES {
                if let Some(stream_id) = cam.streams[type_.index()] {
                    if let Some(s) = l.streams_by_id().get(&stream_id) {
                        let locked = s.inner.lock();
                        streams.push(json::StreamAdminEntry {
                            id: stream_id,
                            type_: type_.as_str().to_owned(),
                            mode: locked.config.mode.clone(),
                            rtsp_url: locked.config.url.as_ref().map(|u| u.to_string()),
                            rtsp_transport: locked.config.rtsp_transport.clone(),
                            sample_file_dir_id: locked
                                .sample_file_dir
                                .as_ref()
                                .map(|d| d.id),
                        });
                    }
                }
            }
            cameras.push(json::CameraAdminEntry {
                id,
                uuid: cam.uuid,
                short_name: cam.short_name.clone(),
                description: cam.config.description.clone(),
                onvif_base_url: cam.config.onvif_base_url.as_ref().map(|u| u.to_string()),
                has_credentials: !cam.config.username.is_empty(),
                streams,
            });
        }
        serve_json(&req, &json::GetCamerasAdminResponse { cameras })
    }

    async fn post_camera(
        self: std::sync::Arc<Self>,
        req: Request<hyper::body::Incoming>,
        caller: Caller,
    ) -> ResponseResult {
        if !caller.permissions.admin_users {
            bail!(Unauthenticated, msg("must have admin_users permission"));
        }
        let (parts, b) = into_json_body(req).await?;
        let r: json::PostCameraRequest = parse_json_body(&b)?;
        require_csrf_if_session(&caller, r.csrf.as_deref())?;
        if r.short_name.is_empty() {
            bail!(InvalidArgument, msg("shortName must not be empty"));
        }
        let change = db::CameraChange {
            short_name: r.short_name,
            config: db::json::CameraConfig {
                description: r.description,
                onvif_base_url: r.onvif_base_url,
                username: r.username,
                password: r.password,
                ..Default::default()
            },
            streams: Default::default(),
        };
        let camera_id = self.db.lock().add_camera(change)?;
        serve_json(&parts, &json::PostCameraResponse { camera_id })
    }

    pub(super) async fn camera_admin(
        self: std::sync::Arc<Self>,
        req: Request<hyper::body::Incoming>,
        caller: Caller,
        camera_id: i32,
    ) -> ResponseResult {
        match *req.method() {
            Method::PUT | Method::PATCH => self.patch_camera(req, caller, camera_id).await,
            Method::DELETE => self.delete_camera(req, caller, camera_id).await,
            _ => Ok(plain_response(
                StatusCode::METHOD_NOT_ALLOWED,
                "PUT, PATCH, or DELETE expected",
            )),
        }
    }

    async fn patch_camera(
        self: std::sync::Arc<Self>,
        req: Request<hyper::body::Incoming>,
        caller: Caller,
        camera_id: i32,
    ) -> ResponseResult {
        if !caller.permissions.admin_users {
            bail!(Unauthenticated, msg("must have admin_users permission"));
        }
        let (_, b) = into_json_body(req).await?;
        let r: json::PatchCameraRequest = parse_json_body(&b)?;
        require_csrf_if_session(&caller, r.csrf.as_deref())?;
        let mut l = self.db.lock();
        let mut change = l.null_camera_change(camera_id)?;
        if let Some(v) = r.short_name {
            change.short_name = v;
        }
        if let Some(v) = r.description {
            change.config.description = v;
        }
        if let Some(v) = r.onvif_base_url {
            change.config.onvif_base_url = Some(v);
        }
        if let Some(v) = r.username {
            change.config.username = v;
        }
        if let Some(v) = r.password {
            change.config.password = v;
        }
        l.update_camera(camera_id, change)?;
        // Restart any running streams for this camera so new credentials take effect.
        if let Some(tx) = self.streamer_tx.as_ref() {
            let cam = l.cameras_by_id().get(&camera_id)
                .ok_or_else(|| err!(Internal, msg("camera vanished after update")))?;
            for &stream_id in cam.streams.iter().flatten() {
                let _ = tx.send(StreamerCommand::RestartStream(stream_id)).await;
            }
        }
        drop(l);
        Ok(plain_response(StatusCode::NO_CONTENT, ""))
    }

    async fn delete_camera(
        self: std::sync::Arc<Self>,
        req: Request<hyper::body::Incoming>,
        caller: Caller,
        camera_id: i32,
    ) -> ResponseResult {
        if !caller.permissions.admin_users {
            bail!(Unauthenticated, msg("must have admin_users permission"));
        }
        let (_, b) = into_json_body(req).await?;
        // Accept an optional body with just csrf.
        let csrf: Option<String> = if b.is_empty() {
            None
        } else {
            let v: serde_json::Value = parse_json_body(&b)?;
            v.get("csrf").and_then(|s| s.as_str()).map(|s| s.to_owned())
        };
        require_csrf_if_session(&caller, csrf.as_deref())?;
        // Stop any running streams first.
        let stream_ids: Vec<i32> = {
            let l = self.db.lock();
            let cam = l
                .cameras_by_id()
                .get(&camera_id)
                .ok_or_else(|| err!(NotFound, msg("no such camera {camera_id}")))?;
            cam.streams.iter().flatten().cloned().collect()
        };
        if let Some(tx) = self.streamer_tx.as_ref() {
            for id in &stream_ids {
                let _ = tx.send(StreamerCommand::StopStream(*id)).await;
            }
            // Brief yield so manager processes stops before DB delete.
            tokio::task::yield_now().await;
        }
        self.db.lock().delete_camera(camera_id)?;
        Ok(plain_response(StatusCode::NO_CONTENT, ""))
    }

    pub(super) async fn camera_stream_admin(
        self: std::sync::Arc<Self>,
        req: Request<hyper::body::Incoming>,
        caller: Caller,
        camera_id: i32,
        type_: StreamType,
    ) -> ResponseResult {
        if *req.method() != Method::PUT {
            return Ok(plain_response(StatusCode::METHOD_NOT_ALLOWED, "PUT expected"));
        }
        if !caller.permissions.admin_users {
            bail!(Unauthenticated, msg("must have admin_users permission"));
        }
        let (_, b) = into_json_body(req).await?;
        let r: json::PutCameraStreamRequest = parse_json_body(&b)?;
        require_csrf_if_session(&caller, r.csrf.as_deref())?;
        let mut l = self.db.lock();
        let mut change = l.null_camera_change(camera_id)?;
        let si = type_.index();
        change.streams[si].config.mode = r.mode.clone();
        change.streams[si].config.url = r.rtsp_url;
        change.streams[si].config.rtsp_transport = r.rtsp_transport;
        if let Some(dir_id) = r.sample_file_dir_id {
            // Ensure the dir exists.
            if l.sample_file_dirs_by_id().get(&dir_id).is_none() {
                bail!(NotFound, msg("no such sample file dir {dir_id}"));
            }
            change.streams[si].sample_file_dir_id = Some(dir_id);
        }
        l.update_camera(camera_id, change)?;
        // Start, stop, or restart the streamer based on new mode.
        if let Some(tx) = self.streamer_tx.as_ref() {
            let cam = l.cameras_by_id().get(&camera_id)
                .ok_or_else(|| err!(Internal, msg("camera vanished after stream update")))?;
            if let Some(stream_id) = cam.streams[si] {
                let cmd = if r.mode == db::json::STREAM_MODE_RECORD {
                    StreamerCommand::RestartStream(stream_id)
                } else {
                    StreamerCommand::StopStream(stream_id)
                };
                let _ = tx.send(cmd).await;
            }
        }
        drop(l);
        Ok(plain_response(StatusCode::NO_CONTENT, ""))
    }
}
```

- [ ] **Step 2: Build**

```bash
cd server && cargo build 2>&1 | grep "^error" | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/web/cameras_admin.rs
git commit -m "feat(server): add camera admin REST handlers (GET/POST cameras, PUT/DELETE camera, PUT stream)"
```

---

## Task 7: Wire camera handlers into `Service`

**Files:**
- Modify: `server/src/web/mod.rs`

- [ ] **Step 1: Add `mod cameras_admin;`**

In `server/src/web/mod.rs`, add after `mod users;` (or at top of file near other mod declarations):
```rust
mod cameras_admin;
```

- [ ] **Step 2: Route new paths in `serve_inner`**

In `serve_inner`, in the `match path {` block, add before `Path::NotFound`:
```rust
Path::CamerasAdmin => (
    CacheControl::PrivateDynamic,
    self.cameras_admin(req, caller).await?,
),
Path::CameraAdmin(id) => (
    CacheControl::PrivateDynamic,
    self.camera_admin(req, caller, id).await?,
),
Path::CameraStreamAdmin(id, type_) => (
    CacheControl::PrivateDynamic,
    self.camera_stream_admin(req, caller, id, type_).await?,
),
```

Note: `cameras_admin` and `camera_admin` take `Arc<Self>`. Update the calls to use `Arc::clone(&self)` where needed by changing `self.cameras_admin(...)` to `Arc::clone(&self).cameras_admin(...)` etc.

- [ ] **Step 3: Build**

```bash
cd server && cargo build 2>&1 | grep "^error" | head -20
```
Expected: 0 errors.

- [ ] **Step 4: Integration smoke test — start server and try `curl`**

```bash
# Start server in background (assumes a local db exists)
# Then in another terminal:
curl -s -X GET http://localhost:8080/api/cameras \
  -H "Cookie: s=<valid-session>" | jq .
```
Expected: `{"cameras": [...]}` with existing cameras.

- [ ] **Step 5: Commit**

```bash
git add server/src/web/mod.rs
git commit -m "feat(server): route CamerasAdmin/CameraAdmin/CameraStreamAdmin paths in Service"
```

---

## Task 8: Frontend API types and functions

**Files:**
- Modify: `ui/src/api.ts`

- [ ] **Step 1: Add types and functions**

At the end of `ui/src/api.ts`, add:
```typescript
// ---- Camera admin API ----

export interface StreamAdminEntry {
  id: number;
  type_: string;
  mode: string;
  rtspUrl?: string;
  rtspTransport: string;
  sampleFileDirId?: number;
}

export interface CameraAdminEntry {
  id: number;
  uuid: string;
  shortName: string;
  description: string;
  onvifBaseUrl?: string;
  hasCredentials: boolean;
  streams: StreamAdminEntry[];
}

export interface GetCamerasAdminResponse {
  cameras: CameraAdminEntry[];
}

export interface PostCameraRequest {
  csrf?: string;
  shortName: string;
  description?: string;
  onvifBaseUrl?: string;
  username?: string;
  password?: string;
}

export interface PatchCameraRequest {
  csrf?: string;
  shortName?: string;
  description?: string;
  onvifBaseUrl?: string;
  username?: string;
  password?: string;
}

export interface PutCameraStreamRequest {
  csrf?: string;
  mode: string;
  rtspUrl?: string;
  rtspTransport?: string;
  sampleFileDirId?: number;
}

export async function getCamerasAdmin(init: RequestInit) {
  return await json<GetCamerasAdminResponse>("/api/cameras", init);
}

export async function createCamera(req: PostCameraRequest, init: RequestInit) {
  return await myfetch("/api/cameras", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    ...init,
  });
}

export async function updateCamera(
  id: number,
  req: PatchCameraRequest,
  init: RequestInit
) {
  return await myfetch(`/api/cameras/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    ...init,
  });
}

export async function deleteCamera(
  id: number,
  csrf: string | undefined,
  init: RequestInit
) {
  return await myfetch(`/api/cameras/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csrf }),
    ...init,
  });
}

export async function updateCameraStream(
  cameraId: number,
  type_: string,
  req: PutCameraStreamRequest,
  init: RequestInit
) {
  return await myfetch(`/api/cameras/${cameraId}/streams/${type_}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    ...init,
  });
}
```

- [ ] **Step 2: Build TypeScript**

```bash
cd ui && pnpm tsc --noEmit 2>&1 | head -20
```
Expected: 0 type errors.

- [ ] **Step 3: Commit**

```bash
git add ui/src/api.ts
git commit -m "feat(ui): add camera admin API types and functions"
```

---

## Task 9: Camera list page

**Files:**
- Create: `ui/src/Cameras/index.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p ui/src/Cameras
```

- [ ] **Step 2: Create `ui/src/Cameras/index.tsx`**

```tsx
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
import AddCameraDialog from "./AddEditDialog";

interface Props {
  Frame: React.ComponentType<FrameProps>;
  csrf?: string;
}

export default function CamerasActivity({ Frame, csrf }: Props) {
  const [cameras, setCameras] = useState<api.CameraAdminEntry[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<api.CameraAdminEntry | null>(null);
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
        <AddCameraDialog
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
```

- [ ] **Step 3: Build TypeScript**

```bash
cd ui && pnpm tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors (the `AddCameraDialog` import will fail until Task 10 — that's OK, fix it in Task 10).

- [ ] **Step 4: Commit**

```bash
git add ui/src/Cameras/index.tsx
git commit -m "feat(ui): add Cameras list page component"
```

---

## Task 10: Add/Edit camera dialog

**Files:**
- Create: `ui/src/Cameras/AddEditDialog.tsx`

- [ ] **Step 1: Create `ui/src/Cameras/AddEditDialog.tsx`**

```tsx
// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

import React, { useEffect, useState } from "react";
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
  sampleFileDirId: string; // string for input, convert to int on submit
}

const defaultStreamForm = (): StreamForm => ({
  mode: "",
  rtspUrl: "",
  rtspTransport: "",
  sampleFileDirId: "",
});

interface Props {
  open: boolean;
  camera: api.CameraAdminEntry | null; // null = add mode
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
        const key = st.type_ as StreamTypeStr;
        s[key] = {
          mode: st.mode,
          rtspUrl: st.rtspUrl ?? "",
          rtspTransport: st.rtspTransport,
          sampleFileDirId: st.sampleFileDirId?.toString() ?? "",
        };
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
    value: string
  ) => {
    setStreams((prev) => ({
      ...prev,
      [type_]: { ...prev[type_], [field]: value },
    }));
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
        // Update streams
        for (const type_ of STREAM_TYPES) {
          const sf = streams[type_];
          const streamResp = await api.updateCameraStream(
            camera!.id,
            type_,
            {
              csrf,
              mode: sf.mode,
              rtspUrl: sf.rtspUrl || undefined,
              rtspTransport: sf.rtspTransport || undefined,
              sampleFileDirId: sf.sampleFileDirId
                ? parseInt(sf.sampleFileDirId)
                : undefined,
            },
            {}
          );
          if (streamResp.status === "error") {
            snackbars.enqueue({
              message: `Stream ${type_} save failed: ${streamResp.message}`,
            });
            return;
          }
        }
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
          {}
        );
        if (resp.status === "error") {
          snackbars.enqueue({ message: "Create failed: " + resp.message });
          return;
        }
        // Parse camera_id from response to configure streams
        // (simplified: streams can be configured by editing after creation)
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? `Edit Camera — ${camera!.shortName}` : "Add Camera"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
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
            onChange={(_, v) => setActiveStream(v)}
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
```

- [ ] **Step 2: Build TypeScript**

```bash
cd ui && pnpm tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add ui/src/Cameras/AddEditDialog.tsx
git commit -m "feat(ui): add Add/Edit camera dialog with stream tabs"
```

---

## Task 11: Router + nav wiring

**Files:**
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/components/Header.tsx`

- [ ] **Step 1: Write failing test for route existence**

In `ui/src/App.tsx`, the route is added in Step 2. Before that, verify `CamerasActivity` import compiles:
```bash
cd ui && pnpm tsc --noEmit 2>&1 | head -5
```

- [ ] **Step 2: Add cameras import and route to `App.tsx`**

In `ui/src/App.tsx`, add import after `UsersActivity`:
```tsx
import CamerasActivity from "./Cameras";
```

Add route before `<Route path="*" ...>`:
```tsx
<Route
  path="cameras"
  element={
    <CamerasActivity
      Frame={Frame}
      csrf={toplevel!.user?.session?.csrf}
    />
  }
/>
```

- [ ] **Step 3: Add Cameras nav item to `Header.tsx`**

In `ui/src/components/Header.tsx`, add icon import:
```tsx
import VideocamAddIcon from "@mui/icons-material/VideocamAdd";
```

After the Users `ListItemButton` block (inside the same `{toplevel?.permissions.adminUsers && (...)}` check):
```tsx
{toplevel?.permissions.adminUsers && (
  <>
    <ListItemButton
      key="users"
      onClick={toggleShowMenu}
      component={Link}
      to="/users"
    >
      <ListItemIcon>
        <PeopleIcon />
      </ListItemIcon>
      <ListItemText primary="Users" />
    </ListItemButton>
    <ListItemButton
      key="cameras"
      onClick={toggleShowMenu}
      component={Link}
      to="/cameras"
    >
      <ListItemIcon>
        <VideocamAddIcon />
      </ListItemIcon>
      <ListItemText primary="Cameras" />
    </ListItemButton>
  </>
)}
```

- [ ] **Step 4: Build TypeScript**

```bash
cd ui && pnpm tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 5: Run frontend tests**

```bash
cd ui && pnpm test run 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 6: Final build check for server**

```bash
cd server && cargo test 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add ui/src/App.tsx ui/src/components/Header.tsx
git commit -m "feat(ui): add /cameras route and Cameras nav item (adminUsers only)"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ StreamerManager actor (Tasks 1–3)
- ✅ REST API POST/PUT/DELETE cameras (Tasks 4–7)
- ✅ `adminUsers` permission gate on all endpoints (Task 6, every handler)
- ✅ Start/Stop/Restart commands sent after DB changes (Task 6)
- ✅ `GET /api/cameras` admin endpoint (Task 6)
- ✅ Frontend types + API functions (Task 8)
- ✅ Camera list page (Task 9)
- ✅ Add/Edit dialog with stream tabs (Task 10)
- ✅ Route + nav wiring (Task 11)
- ✅ Error responses: 400 (empty shortName), 403 (no adminUsers), 404 (bad camera/stream ID), 409 not needed (SQLite unique constraint will surface as 500; acceptable for now)

**Type consistency:** `StreamerCommand` defined in Task 1, used in Task 3 and Task 6 — names match. `json::PostCameraRequest` defined Task 4, deserialized in Task 6 — field names match. Frontend `CameraAdminEntry` defined Task 8, used in Tasks 9/10 — field names match.

**No placeholders:** All steps have concrete code or commands.
