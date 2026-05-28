# Process Telemetry MVP Design

## Goal

Add honest, process-specific runtime telemetry for Moonfire NVR so the Dashboard can show real resource usage without inventing system-wide CPU, RAM, bandwidth, or I/O numbers.

The first version focuses on metrics that can be measured reliably for the Moonfire process itself. If a metric is not available on the current platform, the API and UI must label it unavailable rather than showing estimated or fake data.

## Scope

Implement a backend endpoint that reports Moonfire process telemetry and a Dashboard integration that displays the values when available.

In scope:

- Moonfire process memory usage.
- Moonfire process disk I/O counters and per-second rates.
- Sampling metadata such as timestamp, process id, and platform support state.
- Dashboard KPI/panel updates using the telemetry endpoint.
- Clear unavailable states for unsupported metrics.

Out of scope for the MVP:

- Whole-system CPU/RAM/network/disk stats.
- Fake or inferred network bandwidth.
- eBPF, netlink, packet capture, or other complex per-process network accounting.
- Per-camera or per-stream telemetry breakdowns.
- Historical telemetry persistence.

## API Design

Add a dedicated endpoint:

`GET /api/system/process-telemetry`

The endpoint returns process-scoped telemetry only. It should not be folded into the top-level `/api/` response because telemetry is realtime, sampled, and refreshed at a different cadence from application metadata.

Suggested JSON shape:

```json
{
  "sampledAt": "2026-05-28T15:10:00Z",
  "pid": 12345,
  "memory": {
    "status": "available",
    "residentBytes": 2147483648,
    "virtualBytes": 5368709120
  },
  "io": {
    "status": "available",
    "readBytesPerSec": 120000,
    "writeBytesPerSec": 5400000,
    "totalReadBytes": 982344000,
    "totalWriteBytes": 12093844000
  },
  "network": {
    "status": "unavailable",
    "reason": "process network counters are not available in the MVP"
  }
}
```

Use tagged status fields for each metric group so the UI can distinguish unsupported metrics from transient request errors.

## Backend Behavior

Memory telemetry should report process memory, not host memory. On Linux, this can be read from process status data such as `/proc/self/status` or via an existing/new Rust dependency if it fits the project better.

Disk I/O telemetry should report process I/O counters. On Linux, `/proc/self/io` exposes counters such as read/write bytes. The server should keep the previous sample in memory and compute bytes-per-second deltas when possible.

If this is the first sample after startup, the endpoint may return totals with zero or unavailable rates until the next sample. This avoids pretending a rate exists without a prior sample.

Network telemetry should explicitly return unavailable in the MVP. Per-process network bandwidth is not reliably available through a simple cross-platform OS counter. A later design can instrument Moonfire's RTSP/HTTP/file streaming paths to count bytes at application boundaries.

## UI Design

Dashboard should add or adapt metrics using process telemetry:

- `Process Memory`: show resident memory when available.
- `Recorder I/O`: show write rate and optionally read rate.
- `Network`: show `Network telemetry unavailable` until real application-level counters exist.

The existing data-honesty rule remains: if the endpoint is missing, fails, or returns unavailable for a group, the UI shows an unavailable state and does not substitute fake bandwidth, CPU, or RAM values.

The Dashboard should poll process telemetry independently from the top-level API, likely every 5-10 seconds. It should avoid blocking the main dashboard if telemetry fails.

## Error Handling

- Endpoint request failure: Dashboard shows `Process telemetry unavailable` in the affected cards or panel.
- Unsupported platform or missing OS files: API returns metric-group `status: "unavailable"` with a short reason.
- First sample without enough delta history: API returns totals and a clear rate unavailable/zero state, depending on implementation details.
- Malformed telemetry should be treated as unavailable in the UI.

## Testing

Backend tests should cover:

- Serialization shape for available memory and I/O metrics.
- Unavailable metric groups.
- Rate calculation from two samples.
- First-sample behavior.

UI tests should cover:

- Process memory renders when telemetry is available.
- I/O write/read rates render when telemetry is available.
- Network unavailable state renders without fake bandwidth.
- Endpoint failure does not break Dashboard rendering.

Manual browser verification should cover:

- Dashboard first viewport on desktop.
- A mobile viewport.
- Telemetry available state if running on Linux with process counters.
- Telemetry unavailable state via mocked or forced error response.

## Future Extensions

A later full telemetry design can instrument Moonfire internals to count bytes by subsystem:

- RTSP ingest bytes.
- Recording file writes.
- Archive playback reads.
- Live streaming outgoing bytes.
- Per-camera or per-stream throughput.

That future work should use explicit application counters rather than OS-level guesses for per-process network usage.
