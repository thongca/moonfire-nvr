# Process Telemetry MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real process-scoped telemetry endpoint for Moonfire NVR and display honest memory/I/O telemetry on the Dashboard without fake network bandwidth.

**Architecture:** Add a small backend telemetry module that reads Linux `/proc/self/status` and `/proc/self/io`, keeps the previous I/O sample in server state, and exposes `GET /api/system/process-telemetry`. Add matching TypeScript API types/fetcher and have the Dashboard poll telemetry independently from the top-level API while rendering unavailable states if data is missing.

**Tech Stack:** Rust server with `serde`, existing `server/src/web` routing, React 19 + TypeScript + MUI frontend, Vitest/MSW tests, Playwright browser smoke checks.

---

## File Structure

- Create `server/src/process_telemetry.rs`: process telemetry structs, `/proc` parsing helpers, sample/rate calculation, and tests.
- Modify `server/src/main.rs` or `server/src/lib.rs` module declarations as appropriate for this crate so `process_telemetry` is compiled.
- Modify `server/src/web/mod.rs`: add telemetry state to the web server struct, serve JSON for process telemetry.
- Modify `server/src/web/path.rs`: decode `/api/system/process-telemetry`.
- Modify `ui/src/api.ts`: add telemetry response TypeScript types and `processTelemetry()` fetcher.
- Modify `ui/src/Dashboard.tsx`: poll telemetry, replace appropriate KPI content with process memory/I/O/unavailable network states.
- Modify `ui/src/Dashboard.test.tsx`: mock telemetry endpoint and assert available/unavailable states.
- Use existing formatting and test commands; do not commit generated screenshots or temporary Playwright scripts.

---

### Task 1: Backend Telemetry Parsing and Rate Model

**Files:**
- Create: `server/src/process_telemetry.rs`
- Modify: crate module declaration file if needed, likely `server/src/main.rs` or `server/src/lib.rs`
- Test: `server/src/process_telemetry.rs`

- [ ] **Step 1: Write failing Rust unit tests for `/proc` parsing and rate calculation**

Create `server/src/process_telemetry.rs` with tests first. Include the public shape now, but make implementations return `None`/zero so tests fail for the right reason.

```rust
use serde::Serialize;
use std::time::{Duration, SystemTime};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum MemoryTelemetry {
    Available {
        resident_bytes: u64,
        virtual_bytes: u64,
    },
    Unavailable { reason: String },
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum IoTelemetry {
    Available {
        read_bytes_per_sec: Option<u64>,
        write_bytes_per_sec: Option<u64>,
        total_read_bytes: u64,
        total_write_bytes: u64,
    },
    Unavailable { reason: String },
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum NetworkTelemetry {
    Unavailable { reason: String },
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessTelemetryResponse {
    pub sampled_at_unix_ms: u128,
    pub pid: u32,
    pub memory: MemoryTelemetry,
    pub io: IoTelemetry,
    pub network: NetworkTelemetry,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IoCounters {
    pub read_bytes: u64,
    pub write_bytes: u64,
}

#[derive(Debug, Clone, Copy)]
pub struct IoSample {
    pub at: SystemTime,
    pub counters: IoCounters,
}

pub fn parse_status_memory(_status: &str) -> Option<(u64, u64)> {
    None
}

pub fn parse_io_counters(_io: &str) -> Option<IoCounters> {
    None
}

pub fn calculate_io_rates(_previous: IoSample, _current: IoSample) -> (Option<u64>, Option<u64>) {
    (None, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_process_memory_from_proc_status_kib() {
        let status = "Name:\tmoonfire-nvr\nVmSize:\t  5242880 kB\nVmRSS:\t  2097152 kB\n";

        let parsed = parse_status_memory(status);

        assert_eq!(parsed, Some((2_147_483_648, 5_368_709_120)));
    }

    #[test]
    fn returns_none_when_process_memory_fields_are_missing() {
        let status = "Name:\tmoonfire-nvr\nVmPeak:\t  5242880 kB\n";

        let parsed = parse_status_memory(status);

        assert_eq!(parsed, None);
    }

    #[test]
    fn parses_process_io_counters() {
        let io = "rchar: 10\nwchar: 20\nread_bytes: 4096\nwrite_bytes: 8192\ncancelled_write_bytes: 0\n";

        let parsed = parse_io_counters(io);

        assert_eq!(parsed, Some(IoCounters { read_bytes: 4096, write_bytes: 8192 }));
    }

    #[test]
    fn calculates_io_rates_from_two_samples() {
        let previous = IoSample {
            at: SystemTime::UNIX_EPOCH,
            counters: IoCounters { read_bytes: 1_000, write_bytes: 2_000 },
        };
        let current = IoSample {
            at: SystemTime::UNIX_EPOCH + Duration::from_secs(2),
            counters: IoCounters { read_bytes: 5_000, write_bytes: 12_000 },
        };

        let rates = calculate_io_rates(previous, current);

        assert_eq!(rates, (Some(2_000), Some(5_000)));
    }

    #[test]
    fn returns_no_rates_for_zero_duration_samples() {
        let previous = IoSample {
            at: SystemTime::UNIX_EPOCH,
            counters: IoCounters { read_bytes: 1_000, write_bytes: 2_000 },
        };
        let current = IoSample {
            at: SystemTime::UNIX_EPOCH,
            counters: IoCounters { read_bytes: 5_000, write_bytes: 12_000 },
        };

        let rates = calculate_io_rates(previous, current);

        assert_eq!(rates, (None, None));
    }
}
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
cd server
cargo test process_telemetry --lib
```

Expected: tests fail because `parse_status_memory`, `parse_io_counters`, and `calculate_io_rates` are stubbed.

- [ ] **Step 3: Implement parsing and rate calculation**

Replace the stub functions in `server/src/process_telemetry.rs` with:

```rust
fn parse_kib_line(line: &str, key: &str) -> Option<u64> {
    let rest = line.strip_prefix(key)?.trim();
    let value = rest.strip_suffix(" kB")?.trim().parse::<u64>().ok()?;
    Some(value * 1024)
}

pub fn parse_status_memory(status: &str) -> Option<(u64, u64)> {
    let mut resident = None;
    let mut virtual_size = None;
    for line in status.lines() {
        if resident.is_none() {
            resident = parse_kib_line(line, "VmRSS:");
        }
        if virtual_size.is_none() {
            virtual_size = parse_kib_line(line, "VmSize:");
        }
    }
    Some((resident?, virtual_size?))
}

fn parse_u64_line(line: &str, key: &str) -> Option<u64> {
    line.strip_prefix(key)?.trim().parse::<u64>().ok()
}

pub fn parse_io_counters(io: &str) -> Option<IoCounters> {
    let mut read_bytes = None;
    let mut write_bytes = None;
    for line in io.lines() {
        if read_bytes.is_none() {
            read_bytes = parse_u64_line(line, "read_bytes:");
        }
        if write_bytes.is_none() {
            write_bytes = parse_u64_line(line, "write_bytes:");
        }
    }
    Some(IoCounters { read_bytes: read_bytes?, write_bytes: write_bytes? })
}

pub fn calculate_io_rates(previous: IoSample, current: IoSample) -> (Option<u64>, Option<u64>) {
    let Ok(elapsed) = current.at.duration_since(previous.at) else {
        return (None, None);
    };
    let elapsed_secs = elapsed.as_secs_f64();
    if elapsed_secs <= 0.0 {
        return (None, None);
    }
    let read_delta = current.counters.read_bytes.saturating_sub(previous.counters.read_bytes);
    let write_delta = current.counters.write_bytes.saturating_sub(previous.counters.write_bytes);
    (
        Some((read_delta as f64 / elapsed_secs).round() as u64),
        Some((write_delta as f64 / elapsed_secs).round() as u64),
    )
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
cd server
cargo test process_telemetry --lib
```

Expected: all `process_telemetry` tests pass.

- [ ] **Step 5: Commit backend parsing model**

```bash
git add server/src/process_telemetry.rs server/src/main.rs server/src/lib.rs
git commit -m "feat: add process telemetry parser"
```

If this workspace is not meant to commit yet because of existing unrelated changes, skip the commit and record that in the implementation notes.

---

### Task 2: Backend Endpoint and Server State

**Files:**
- Modify: `server/src/process_telemetry.rs`
- Modify: `server/src/web/path.rs`
- Modify: `server/src/web/mod.rs`
- Test: `server/src/web/path.rs`, `server/src/process_telemetry.rs`

- [ ] **Step 1: Add failing path decode test**

In `server/src/web/path.rs` tests, add:

```rust
#[test]
fn decodes_process_telemetry_path() {
    assert_eq!(Path::decode("/api/system/process-telemetry"), Path::ProcessTelemetry);
}
```

Also add the enum variant near the other API variants:

```rust
ProcessTelemetry, // "/api/system/process-telemetry"
```

Do not implement decode yet.

- [ ] **Step 2: Run path test and verify it fails**

Run:

```bash
cd server
cargo test web::path::tests::decodes_process_telemetry_path --lib
```

Expected: fail because decode returns `Path::NotFound`.

- [ ] **Step 3: Implement path decode**

In `Path::decode`, add this branch before camera/user prefix parsing:

```rust
} else if path == "system/process-telemetry" {
    return Path::ProcessTelemetry;
} else if path == "sample-file-dirs" {
```

- [ ] **Step 4: Add process telemetry sampler implementation**

In `server/src/process_telemetry.rs`, add filesystem-backed sampling and mutable sampler state:

```rust
use std::fs;
use std::sync::Mutex;

#[derive(Debug, Default)]
pub struct ProcessTelemetrySampler {
    previous_io: Mutex<Option<IoSample>>,
}

impl ProcessTelemetrySampler {
    pub fn sample(&self) -> ProcessTelemetryResponse {
        let sampled_at = SystemTime::now();
        let memory = match fs::read_to_string("/proc/self/status") {
            Ok(status) => match parse_status_memory(&status) {
                Some((resident_bytes, virtual_bytes)) => MemoryTelemetry::Available {
                    resident_bytes,
                    virtual_bytes,
                },
                None => MemoryTelemetry::Unavailable {
                    reason: "process memory fields were not present in /proc/self/status".to_owned(),
                },
            },
            Err(e) => MemoryTelemetry::Unavailable {
                reason: format!("unable to read /proc/self/status: {e}"),
            },
        };

        let io = match fs::read_to_string("/proc/self/io") {
            Ok(io_body) => match parse_io_counters(&io_body) {
                Some(counters) => {
                    let current = IoSample { at: sampled_at, counters };
                    let previous = {
                        let mut guard = self.previous_io.lock().expect("process telemetry mutex poisoned");
                        let previous = *guard;
                        *guard = Some(current);
                        previous
                    };
                    let (read_bytes_per_sec, write_bytes_per_sec) = previous
                        .map(|p| calculate_io_rates(p, current))
                        .unwrap_or((None, None));
                    IoTelemetry::Available {
                        read_bytes_per_sec,
                        write_bytes_per_sec,
                        total_read_bytes: counters.read_bytes,
                        total_write_bytes: counters.write_bytes,
                    }
                }
                None => IoTelemetry::Unavailable {
                    reason: "process I/O fields were not present in /proc/self/io".to_owned(),
                },
            },
            Err(e) => IoTelemetry::Unavailable {
                reason: format!("unable to read /proc/self/io: {e}"),
            },
        };

        ProcessTelemetryResponse {
            sampled_at_unix_ms: sampled_at
                .duration_since(SystemTime::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0),
            pid: std::process::id(),
            memory,
            io,
            network: NetworkTelemetry::Unavailable {
                reason: "process network counters are not available in the MVP".to_owned(),
            },
        }
    }
}
```

- [ ] **Step 5: Wire sampler into web server state**

In `server/src/web/mod.rs`, import the module:

```rust
use crate::process_telemetry::ProcessTelemetrySampler;
```

Find the main web server/shared struct that already owns `db` and `time_zone_name`. Add:

```rust
process_telemetry: ProcessTelemetrySampler,
```

Initialize it where that struct is constructed:

```rust
process_telemetry: ProcessTelemetrySampler::default(),
```

Add a response helper near `top_level`:

```rust
fn process_telemetry(&self, req: &Request<::hyper::body::Incoming>) -> ResponseResult {
    serve_json(req, &self.process_telemetry.sample())
}
```

In `serve_inner` path match, add:

```rust
Path::ProcessTelemetry => (
    CacheControl::PrivateDynamic,
    self.process_telemetry(&req)?,
),
```

- [ ] **Step 6: Run backend tests**

Run:

```bash
cd server
cargo test process_telemetry web::path --lib
```

Expected: telemetry parser tests and path tests pass.

- [ ] **Step 7: Commit backend endpoint**

```bash
git add server/src/process_telemetry.rs server/src/web/path.rs server/src/web/mod.rs
git commit -m "feat: expose process telemetry endpoint"
```

Skip commit if current workspace policy requires batching with existing uncommitted UI changes.

---

### Task 3: Frontend API Types and Fetcher

**Files:**
- Modify: `ui/src/api.ts`
- Test: no standalone test required; Dashboard tests in Task 4 exercise the fetcher contract through MSW.

- [ ] **Step 1: Add TypeScript telemetry types and fetcher**

In `ui/src/api.ts`, after `ToplevelUser`, add:

```typescript
export interface ProcessTelemetryResponse {
  sampledAtUnixMs: number;
  pid: number;
  memory: ProcessMemoryTelemetry;
  io: ProcessIoTelemetry;
  network: ProcessNetworkTelemetry;
}

export type ProcessMemoryTelemetry =
  | {
      status: "available";
      residentBytes: number;
      virtualBytes: number;
    }
  | { status: "unavailable"; reason: string };

export type ProcessIoTelemetry =
  | {
      status: "available";
      readBytesPerSec?: number | null;
      writeBytesPerSec?: number | null;
      totalReadBytes: number;
      totalWriteBytes: number;
    }
  | { status: "unavailable"; reason: string };

export type ProcessNetworkTelemetry = {
  status: "unavailable";
  reason: string;
};

export async function processTelemetry(init: RequestInit) {
  return await json<ProcessTelemetryResponse>(
    "/api/system/process-telemetry",
    init,
  );
}
```

- [ ] **Step 2: Run TypeScript check through build**

Run:

```bash
cd ui
npm run build
```

Expected: build passes or only existing chunk-size warnings appear.

- [ ] **Step 3: Commit frontend API types**

```bash
git add ui/src/api.ts
git commit -m "feat: add process telemetry api client"
```

---

### Task 4: Dashboard Telemetry UI with TDD

**Files:**
- Modify: `ui/src/Dashboard.tsx`
- Modify: `ui/src/Dashboard.test.tsx`

- [ ] **Step 1: Add failing Dashboard tests for telemetry available and unavailable states**

In `ui/src/Dashboard.test.tsx`, add MSW handlers if the file does not already have them. Use the existing test setup style. Add these tests:

```typescript
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockProcessTelemetry(body: unknown) {
  server.use(
    http.get("/api/system/process-telemetry", () => HttpResponse.json(body)),
  );
}
```

Then add:

```typescript
test("shows process memory and recorder I/O telemetry when available", async () => {
  mockProcessTelemetry({
    sampledAtUnixMs: 1_779_978_600_000,
    pid: 1234,
    memory: {
      status: "available",
      residentBytes: 2_147_483_648,
      virtualBytes: 5_368_709_120,
    },
    io: {
      status: "available",
      readBytesPerSec: 120_000,
      writeBytesPerSec: 5_400_000,
      totalReadBytes: 982_344_000,
      totalWriteBytes: 12_093_844_000,
    },
    network: {
      status: "unavailable",
      reason: "process network counters are not available in the MVP",
    },
  });

  renderWithCtx(<DashboardActivity toplevel={makeToplevelFixture()} Frame={Frame} />);

  expect(await screen.findByText("Process Memory")).toBeInTheDocument();
  expect(screen.getByText("2.1 GB")).toBeInTheDocument();
  expect(screen.getByText("Recorder I/O")).toBeInTheDocument();
  expect(screen.getByText(/5.4 MB\/s write/i)).toBeInTheDocument();
  expect(screen.getByText("Network telemetry unavailable")).toBeInTheDocument();
});

test("keeps dashboard usable when process telemetry request fails", async () => {
  server.use(
    http.get("/api/system/process-telemetry", () => HttpResponse.text("nope", { status: 500 })),
  );

  renderWithCtx(<DashboardActivity toplevel={makeToplevelFixture()} Frame={Frame} />);

  expect(screen.getByRole("heading", { name: "System Overview" })).toBeInTheDocument();
  expect(await screen.findByText("Process telemetry unavailable")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run Dashboard tests and verify they fail**

Run:

```bash
cd ui
npm test -- Dashboard.test.tsx --run
```

Expected: new tests fail because Dashboard does not fetch/render process telemetry yet.

- [ ] **Step 3: Implement Dashboard telemetry polling state**

In `ui/src/Dashboard.tsx`, import React hooks and API type if not present:

```typescript
import { useEffect, useState } from "react";
```

Add local state in `DashboardActivity` after stats/cameraHealth:

```typescript
const [processTelemetry, setProcessTelemetry] =
  useState<api.ProcessTelemetryResponse | null>(null);
const [processTelemetryUnavailable, setProcessTelemetryUnavailable] =
  useState(false);

useEffect(() => {
  const abort = new AbortController();
  const load = async () => {
    const resp = await api.processTelemetry({ signal: abort.signal });
    if (resp.status === "success") {
      setProcessTelemetry(resp.response);
      setProcessTelemetryUnavailable(false);
    } else if (resp.status !== "aborted") {
      setProcessTelemetry(null);
      setProcessTelemetryUnavailable(true);
    }
  };
  load();
  const interval = window.setInterval(load, 10_000);
  return () => {
    abort.abort();
    window.clearInterval(interval);
  };
}, []);
```

Add helpers near other helper functions:

```typescript
const formatRate = (bytesPerSec?: number | null) =>
  bytesPerSec === undefined || bytesPerSec === null
    ? "rate pending"
    : `${formatBytes(bytesPerSec)}/s`;

function getProcessMemoryValue(telemetry: api.ProcessTelemetryResponse | null) {
  if (telemetry?.memory.status !== "available") {
    return "Unavailable";
  }
  return formatBytes(telemetry.memory.residentBytes);
}

function getProcessIoValue(telemetry: api.ProcessTelemetryResponse | null) {
  if (telemetry?.io.status !== "available") {
    return "Unavailable";
  }
  return formatRate(telemetry.io.writeBytesPerSec);
}
```

- [ ] **Step 4: Replace or add Dashboard metric cards**

In the KPI row, replace the current `Activity Status` card with a `Process Memory` card, and add process I/O where it best fits the current design. Preserve `Storage Used` and honest recording load.

Use this content for the two process-oriented cards:

```tsx
<MetricCard
  title="Process Memory"
  value={
    processTelemetryUnavailable
      ? "Unavailable"
      : getProcessMemoryValue(processTelemetry)
  }
  detail="resident"
  icon={<MemoryOutlinedIcon fontSize="small" />}
  footer={
    <Typography sx={{ ...labelSx, mt: 0.5 }}>
      {processTelemetry?.memory.status === "available"
        ? `${formatBytes(processTelemetry.memory.virtualBytes)} virtual`
        : "Process telemetry unavailable"}
    </Typography>
  }
/>
<MetricCard
  title="Recorder I/O"
  value={
    processTelemetryUnavailable ? "Unavailable" : getProcessIoValue(processTelemetry)
  }
  detail="write"
  icon={<StorageOutlinedIcon fontSize="small" />}
  footer={
    <Typography sx={{ ...labelSx, mt: 0.5 }}>
      {processTelemetry?.io.status === "available"
        ? `${formatRate(processTelemetry.io.readBytesPerSec)} read`
        : "Process telemetry unavailable"}
    </Typography>
  }
/>
```

Add a small network unavailable line in the report or metric area:

```tsx
<Typography sx={{ ...labelSx, mt: 1 }}>
  Network telemetry unavailable
</Typography>
```

Do not show Mbps or bandwidth unless a future endpoint provides real process network counters.

- [ ] **Step 5: Run Dashboard tests and verify they pass**

Run:

```bash
cd ui
npm test -- Dashboard.test.tsx --run
```

Expected: Dashboard tests pass, including process telemetry available and failure cases.

- [ ] **Step 6: Commit Dashboard telemetry UI**

```bash
git add ui/src/Dashboard.tsx ui/src/Dashboard.test.tsx
git commit -m "feat: show process telemetry on dashboard"
```

---

### Task 5: End-to-End Verification

**Files:**
- No source changes expected.
- Temporary scripts/screenshots go under `/tmp`, not the repo.

- [ ] **Step 1: Run backend tests**

Run:

```bash
cd server
cargo test process_telemetry web::path --lib
```

Expected: pass.

- [ ] **Step 2: Run frontend focused tests**

Run:

```bash
cd ui
npm test -- Dashboard.test.tsx Settings.test.tsx Header.test.tsx --run
```

Expected: pass.

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd ui
npm run build
```

Expected: pass; existing Vite chunk-size warnings are acceptable.

- [ ] **Step 4: Browser smoke test**

If `npm run dev -- --host 0.0.0.0 --port 5175` fails with file watcher limits, run production preview after build:

```bash
cd ui
npm run preview -- --host 0.0.0.0 --port 5175
```

Use Playwright if Browser plugin is unavailable. Save screenshots outside the repo:

```javascript
import pkg from "/home/ai/dev/moonfire-nvr/ui/node_modules/playwright/index.js";
const { chromium } = pkg;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });
const logs = [];
page.on("console", (msg) => logs.push({ type: msg.type(), text: msg.text() }));
page.on("pageerror", (err) => logs.push({ type: "pageerror", text: err.message }));
await page.goto("http://localhost:5175/#/", { waitUntil: "networkidle" });
const body = await page.locator("body").innerText();
console.log({
  title: await page.title(),
  hasProcessMemory: body.includes("Process Memory"),
  hasRecorderIo: body.includes("Recorder I/O"),
  hasFakeBandwidth: body.includes("Mbps"),
  errors: logs.filter((l) => ["error", "warning", "warn", "pageerror"].includes(l.type)),
});
await page.screenshot({ path: "/tmp/moonfire-process-telemetry-dashboard.png", fullPage: true });
await browser.close();
```

Expected: Dashboard loads, process telemetry labels render, no fake Mbps/bandwidth appears, no console/page errors.

- [ ] **Step 5: Final status**

Summarize:

- Endpoint path implemented.
- Process memory and I/O behavior.
- Network intentionally unavailable.
- Tests/build/browser evidence.
- Any platform limitation found during manual testing.

---

## Self-Review

- Spec coverage: endpoint, process memory, process I/O, network unavailable, independent Dashboard polling, error handling, backend/UI/browser tests are covered.
- Placeholder scan: no TODO/TBD or vague implementation steps remain.
- Type consistency: backend camelCase fields map to `ProcessTelemetryResponse`, `ProcessMemoryTelemetry`, `ProcessIoTelemetry`, and `ProcessNetworkTelemetry` in `ui/src/api.ts`.
