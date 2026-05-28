# Sample File Directory Web UI Design

## Goal

Make `Sample File Dir ID` understandable and actionable in the web camera dialog. Users should not need to know an internal numeric ID before configuring recording. They should be able to list existing storage directories, create a new one by path, and select it for a stream from the Add/Edit Camera dialog.

## Problem

The current Add/Edit Camera dialog exposes a raw `Sample File Dir ID` number. This is unclear because:

- The field is a backend database ID, not a path or camera setting.
- The web UI does not explain where the ID comes from.
- Recording requires a sample file directory, but the UI does not make that dependency obvious.
- The only current management path is the terminal config tool under `Directories and retention`.

## User-facing design

### Rename the field

In `ui/src/Cameras/AddEditDialog.tsx`, replace `Sample File Dir ID` with `Storage Directory`.

The control should be a select/dropdown, not a raw number input.

Options:

- `No storage directory`
- `Dir <id> — <path>` for each directory returned by the API

If a stream already has `sampleFileDirId`, preselect the matching directory.

### Create directory inline

Add a compact secondary action near the select:

- `Create directory`

Clicking it reveals an inline form inside the Stream Routing section:

- `Directory path`
- placeholder: `/var/lib/moonfire-nvr/sample`
- `Create`
- `Cancel`

On success:

- Refresh the directory list.
- Select the newly created directory for the active stream.
- Show a snackbar such as `Storage directory Dir <id> created`.

On error:

- Show the backend error in a snackbar.
- Keep the path field open for correction.

### Recording warning

When the active stream has `Mode = Record` and no storage directory selected, show an orange warning below the select:

`Recording requires a storage directory. Create or select one before saving.`

The stream summary card should also show `Storage dir missing` in this state.

When a directory is selected, the summary card should show `Dir <id>`.

### Empty state

If no storage directories exist, the select shows only `No storage directory`, plus helper text:

`No storage directories configured yet. Create one here or with moonfire-nvr config → Directories and retention.`

## Backend API

Add sample file directory admin endpoints.

### GET `/api/sample-file-dirs`

Permission: `readCameraConfigs` or `adminUsers`.

Response:

```json
{
  "sampleFileDirs": [
    { "id": 1, "path": "/var/lib/moonfire-nvr/sample" }
  ]
}
```

### POST `/api/sample-file-dirs`

Permission: `adminUsers`.

Requires CSRF when the caller uses a session.

Request:

```json
{
  "csrf": "...",
  "path": "/var/lib/moonfire-nvr/sample"
}
```

Response:

```json
{
  "id": 1
}
```

Implementation should call the existing database method `db.add_sample_file_dir(path)`.

If the path cannot be opened/created, return the existing backend error rather than hiding it.

## Frontend API

Add TypeScript API helpers in `ui/src/api.ts`:

- `SampleFileDirEntry`
- `GetSampleFileDirsResponse`
- `PostSampleFileDirRequest`
- `PostSampleFileDirResponse`
- `getSampleFileDirs(init)`
- `createSampleFileDir(req, init)`

## Behavior constraints

- Preserve existing camera create/update behavior.
- Preserve existing stream payload field `sampleFileDirId`.
- Do not fake storage directories.
- Do not add delete/edit/retention management in this feature.
- Do not require a storage directory when `Mode = Off`.
- Do not block save client-side yet; warn clearly, but let backend behavior remain authoritative.

## Tests

Backend tests should cover:

- GET returns configured sample file dirs.
- POST creates a sample file dir and returns the new ID.
- POST rejects non-admin callers.
- Camera stream update still rejects unknown `sampleFileDirId`.

Frontend tests should cover:

- Add/Edit dialog fetches and renders storage directory options.
- Existing stream `sampleFileDirId` preselects the matching option.
- `Mode = Record` with no directory shows the warning and summary `Storage dir missing`.
- Creating a directory calls the API, refreshes options, and selects the new directory.
- Save sends selected `sampleFileDirId` in the stream payload.

## Playwright QA

Run a rendered flow with mocked API:

1. Open `/cameras`.
2. Open Add Camera.
3. Confirm `Storage Directory` select is visible.
4. Create a new directory path.
5. Confirm the new `Dir <id> — <path>` option is selected.
6. Set `Mode = Record`, RTSP URL, and Transport.
7. Save and verify stream payload includes `sampleFileDirId`.
8. Check desktop and mobile viewports for layout issues.

## Out of scope

- Full `Directories and retention` management page.
- Delete sample file directories.
- Edit storage directory paths.
- Retention policy controls.
- Disk capacity telemetry.
- Automatic path suggestion from backend.
