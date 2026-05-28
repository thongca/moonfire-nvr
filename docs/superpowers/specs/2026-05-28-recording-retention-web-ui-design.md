# Recording & Retention Web UI Design

## Goal

Make it clear whether a camera is merely configured to record or is actually receiving and writing video, and expose the existing recording retention controls that are currently only available through the CLI/config paths.

Users adding a camera in the web UI should be able to answer three questions without leaving the browser:

1. Is recording configured correctly?
2. Has Moonfire received frames/recordings yet?
3. How much storage will this stream retain, and how often does it flush recording metadata?

## Current behavior

The Add/Edit Camera dialog currently exposes:

- Mode: `Off` or `Record`.
- RTSP URL.
- RTSP transport.
- Storage directory.
- Inline storage directory creation.

The backend already has additional stream config fields:

- `retain_bytes`: per-stream retention quota, in bytes.
- `flush_if_sec`: metadata flush interval, in seconds.

The web admin API currently returns only:

- `mode`.
- `rtspUrl`.
- `rtspTransport`.
- `sampleFileDirId`.

The top-level API exposes runtime counters useful for status:

- `record`.
- `numRecentRecordings`.
- `numRecentFrames`.
- `totalSampleFileBytes`.
- `fsBytes`.
- `retainBytes`.

## Design

### Recording status

Replace vague camera status labels such as `Online` / `Offline` with recording-specific states derived from real API data.

Use these states:

1. `Recording active`
   - At least one stream is configured to record and has received recent frames or recordings.
   - Derived from `record === true` and `numRecentFrames > 0` or `numRecentRecordings > 0`.

2. `Waiting for frames`
   - At least one stream is configured to record, but there are no recent frames/recordings and no sample bytes yet.
   - This indicates configuration is enabled, but recording has not been proven.

3. `Recording configured`
   - Stream is configured to record and has historical bytes, but no recent frame/recording counters are active.
   - This covers cameras that recorded before but may currently be idle or unavailable.

4. `Not configured`
   - No stream is configured to record.

5. `Needs storage`
   - A stream is set to `Record` but has no storage directory selected.

The UI must not claim `Recording active` from config alone.

### Add/Edit Camera dialog

Add a `Recording & Retention` section for the active stream.

Fields:

- `Mode`
  - Existing field.

- `Storage Directory`
  - Existing field.

- `Retention Limit`
  - New web UI field backed by `retain_bytes`.
  - Display and accept human-friendly values such as `50 GB`, `1 TB`, `500 MB`, or `0`.
  - `0` means no retention limit, matching existing backend semantics.
  - Save as integer bytes in `retainBytes`.

- `Metadata Flush Interval`
  - New web UI field backed by `flush_if_sec`.
  - Unit: seconds.
  - Empty or invalid values are not allowed; use `0` for immediate flush.
  - Helper text recommends `120` seconds for normal camera recording.

Helper text:

- Retention by days is not currently supported by the backend. The web UI should explain: `Moonfire currently retains recordings by storage quota, not by number of days.`
- Segment/rotation interval is not currently part of the camera stream admin API. Do not show a fake segment duration field.

### Camera list

The camera table should show recording state and retention summary.

Suggested columns:

- Camera Name.
- Address.
- Recording Status.
- Retention.
- Storage.
- Actions.

Recording Status should show a badge plus detail line, for example:

- `Recording active` / `main: 12 recent frames`.
- `Waiting for frames` / `main: configured, 0 bytes written`.
- `Needs storage` / `main: select a storage directory`.

Retention should show the first recording stream retention, or combined stream retention if multiple streams are recording:

- `50 GB limit`.
- `Unlimited` when `retainBytes` is `0`.
- `—` when no stream is recording.

### Backend API changes

Extend `StreamAdminEntry` and `PutCameraStreamRequest` with:

- `retainBytes: number`.
- `flushIfSec: number`.

The API should preserve existing defaults:

- `retainBytes` defaults to `0`.
- `flushIfSec` defaults to `0`.

Do not introduce day-based retention in this change.

### Error handling

- If retention text cannot be parsed, keep the dialog open and show an inline validation error.
- If flush interval is negative or not an integer, keep the dialog open and show an inline validation error.
- If mode is `Record` and no storage directory is selected, keep the existing warning.
- API errors remain shown through existing snackbars.

### Testing

Add tests covering:

- Admin API serializes and updates `retainBytes` and `flushIfSec`.
- Add/Edit Camera dialog renders retention and flush fields from camera stream data.
- Saving a stream sends parsed `retainBytes` and `flushIfSec`.
- Invalid retention input blocks save and shows validation.
- Camera list status distinguishes `Waiting for frames` from active recording.

## Out of scope

- Retention by days.
- Editing global segment/rotation interval.
- Proving RTSP connectivity beyond existing recording counters.
- New backend streamer health APIs.
