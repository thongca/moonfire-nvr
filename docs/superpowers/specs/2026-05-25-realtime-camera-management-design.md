# Realtime Camera Management — Design Spec

**Date:** 2026-05-25
**Status:** Approved

## Overview

Add the ability to add, edit, and delete cameras at runtime without restarting Moonfire NVR. Changes take effect immediately: the server starts or stops RTSP streamer tasks on demand.

## Goals

- Full CRUD for cameras and their streams via REST API
- Changes reflected immediately (no restart required)
- Web UI integrated into existing moonfire frontend, matching the Moonfire NVR design system (dark theme, Fire Orange #ff5722, Inter + JetBrains Mono)
- Access restricted to users with the existing `adminUsers` permission

## Non-Goals

- Hot-reload of `moonfire.toml` config file (sample dirs, bind addresses, etc.)
- Managing users or signals via this feature
- PTZ controls or stream health monitoring (future scope)

---

## Architecture

### Approach: StreamerManager Actor

A new `StreamerManager` Tokio task owns the lifecycle of all streamer tasks. API handlers communicate with it via an `mpsc` channel — they never directly touch the JoinSet or streamer state.

```
Web UI → HTTP Request → API Handler → db write → mpsc::Sender<StreamerCommand>
                                                        ↓
                                              StreamerManager (task)
                                              ├── JoinSet<()>
                                              └── HashMap<stream_id, shutdown::Sender>
                                                        ↓
                                              Streamer tasks (one per stream)
```

API handlers return immediately after writing to the DB and sending the command. They do not wait for the streamer to connect.

### StreamerManager

```rust
enum StreamerCommand {
    StartStream(i32),    // stream_id
    StopStream(i32),     // stream_id
    RestartStream(i32),  // stream_id
}

struct StreamerManager {
    db: Arc<db::Database>,
    env: &'static streamer::Environment<'static, clock::RealClocks>,
    rx: mpsc::Receiver<StreamerCommand>,
    running: HashMap<i32, base::shutdown::Sender>,
    join_set: JoinSet<()>,
}
```

**StartStream:** reads stream + camera from DB, spawns a new `Streamer` task, stores its shutdown sender in `running`.

**StopStream:** sends shutdown signal via the stored sender, removes from `running`. The task exits via the existing `shutdown_rx.check()` loop in `Streamer::run`.

**RestartStream:** sends shutdown to the old task via its sender, removes it from `running`, then polls `join_set.join_next()` in a loop until the specific task ID is no longer present. Only then spawns the new streamer. This prevents two streamers writing to the same stream concurrently. Task identity is tracked via `AbortHandle` stored alongside the shutdown sender.

The manager loop also drains completed tasks from the JoinSet (via `join_next` with `now_or_never`) to avoid unbounded growth.

### Integration with `inner()`

`inner()` in `server/src/cmds/run/mod.rs` is modified to:
1. Create `StreamerManager` with an `mpsc::channel`
2. Pass `mpsc::Sender<StreamerCommand>` to `web::Service`
3. Spawn `StreamerManager::run()` as a named task
4. On shutdown, drop the sender so the manager loop exits, then await its task

---

## REST API

All endpoints require the caller to have `adminUsers` permission. Requests and responses use JSON, consistent with the existing `server/src/json.rs` patterns.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/cameras` | List all cameras with stream configs (admin view, includes credentials metadata but not plaintext passwords) |
| `POST` | `/api/cameras` | Create a new camera |
| `PUT` | `/api/cameras/{id}` | Update camera metadata (name, description, ONVIF URL, credentials) |
| `DELETE` | `/api/cameras/{id}` | Delete camera and stop all its streams |
| `PUT` | `/api/cameras/{id}/streams/{type}` | Update a stream's config (RTSP URL, transport, mode, sample file dir) |

`{type}` is `main`, `sub`, or `ext`.

### Request / Response Shapes

**POST /api/cameras**
```json
{
  "shortName": "front-door",
  "description": "Front entrance",
  "onvifBaseUrl": "http://192.168.1.10",
  "username": "admin",
  "password": "secret"
}
```
Response: `201 Created` with `{"cameraId": 5}`

**PUT /api/cameras/{id}**
Same fields as POST (all optional, only provided fields are updated).
Response: `204 No Content`

**DELETE /api/cameras/{id}**
Response: `204 No Content`

**PUT /api/cameras/{id}/streams/{type}**
```json
{
  "rtspUrl": "rtsp://192.168.1.10/stream1",
  "rtspTransport": "tcp",
  "mode": "record",
  "sampleFileDirId": 1
}
```
Response: `204 No Content`

After a successful `PUT` on a stream, if the stream was previously running, a `RestartStream` command is sent. If mode changes to `record`, `StartStream` is sent. If mode changes to `off`, `StopStream` is sent.

### Error Codes

| Condition | HTTP Status |
|-----------|-------------|
| Camera not found | 404 |
| Duplicate `shortName` | 409 |
| Missing required field | 400 |
| Insufficient permission | 403 |

---

## Frontend (React)

### New Route: `/cameras`

Added to the existing React router. The nav sidebar shows a **Cameras** item visible only to users with `adminUsers: true`.

### Page Structure

- **Header:** "Camera Management" title + "+ Add Camera" button (Fire Orange, `#ff5722`)
- **Camera table:** columns: Status dot, Name/Description, IP Address (JetBrains Mono), Stream badges (MAIN REC / SUB REC / OFF), Sample Dir, Edit / Delete actions
- **Status dots:** green = online (streamer running), red = offline (streamer not running or disconnected); offline rows have a subtle red tint
- **Edit dialog:** modal overlay with tabs for MAIN / SUB / EXT stream config; fields: Short Name, Description, ONVIF Base URL, Username, Password (with show/hide); per-stream: RTSP URL, Transport (TCP/UDP/Auto), Mode (Record/Off), Sample File Dir
- **Add Camera:** same dialog, empty fields

### API integration

New functions added to `ui/src/api.ts`:
- `listCamerasAdmin()` → `GET /api/cameras`
- `createCamera(req)` → `POST /api/cameras`
- `updateCamera(id, req)` → `PUT /api/cameras/{id}`
- `deleteCamera(id)` → `DELETE /api/cameras/{id}`
- `updateStream(cameraId, type, req)` → `PUT /api/cameras/{cameraId}/streams/{type}`

### Design system

Follows the Moonfire NVR design system (Stitch project `17174465272393731395`):
- Background `#131313`, surface containers `#1c1b1b` / `#201f1f` / `#2a2a2a`
- Primary action color: Fire Orange `#ff5722`
- Typography: Inter for UI text, JetBrains Mono for IP addresses and technical labels
- Border radius: 4px; borders: `1px solid #5b4039`
- Input focus state: border changes to `#ff5722`

Reference screen generated in Stitch: `projects/17174465272393731395/screens/f5b26e5837de420fa07362536d49fb69`

---

## Error Handling

### Backend

- `StartStream` for unknown stream_id: log warning, no-op (prevents crash if DB and manager are briefly out of sync)
- Streamer crash: task ends in JoinSet, manager logs error; the `Streamer::run` loop already handles retries internally
- `RestartStream` when stream not running: treated as `StartStream`
- Delete camera with running streams: `StopStream` is sent for each stream before DB deletion; API waits for stop commands to be enqueued (not for RTSP teardown to complete)

### Frontend

- API errors: toast notification with server-provided message
- Client-side validation before submit: `shortName` required; RTSP URL required when mode = `record`
- On save success: close dialog, refresh camera list

---

## Testing

### Rust unit tests

- `StreamerManager`: use mock opener + mock DB to verify `StartStream` spawns a task, `StopStream` shuts it down gracefully, `RestartStream` stops old task before starting new one
- API handlers: table-driven tests for 400 / 403 / 404 / 409 error paths using mock DB

### Rust integration tests

- Add camera via `db.add_camera()` + send `StartStream` → verify task count in JoinSet increases
- Update stream RTSP URL + send `RestartStream` → verify old task exits and new task starts

### Frontend tests (vitest)

- Form validation: shortName empty → submit blocked; mode=record with empty RTSP URL → submit blocked
- Mock API responses → verify correct state updates (camera added to list, dialog closes, error toast on 409)

---

## Files to Change

**Server:**
- `server/src/cmds/run/mod.rs` — extract streamer pool into `StreamerManager`, wire channel to `web::Service`
- `server/src/streamer_manager.rs` *(new)* — `StreamerManager` struct and actor loop
- `server/src/web/mod.rs` — add `mpsc::Sender<StreamerCommand>` to `Service` config
- `server/src/web/cameras.rs` *(new)* — API handlers for camera CRUD
- `server/src/web/path.rs` — add new path variants: `Cameras`, `Camera`, `CameraStream`
- `server/src/json.rs` — add request/response types for camera API

**Frontend:**
- `ui/src/api.ts` — add camera management functions
- `ui/src/Cameras/index.tsx` *(new)* — camera list page
- `ui/src/Cameras/AddEditDialog.tsx` *(new)* — add/edit dialog component
- `ui/src/App.tsx` (or router file) — add `/cameras` route
- Nav component — add Cameras nav item (conditional on `adminUsers`)
