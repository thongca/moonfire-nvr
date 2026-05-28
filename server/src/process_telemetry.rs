// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2026 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    tag = "status"
)]
pub enum MemoryTelemetry {
    Available {
        resident_bytes: u64,
        virtual_bytes: u64,
    },
    Unavailable {
        reason: String,
    },
}

#[derive(Debug, Serialize)]
#[serde(
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    tag = "status"
)]
pub enum IoTelemetry {
    Available {
        read_bytes_per_sec: Option<u64>,
        write_bytes_per_sec: Option<u64>,
        total_read_bytes: u64,
        total_write_bytes: u64,
    },
    Unavailable {
        reason: String,
    },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum NetworkTelemetry {
    Unavailable { reason: String },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessTelemetryResponse {
    pub sampled_at_unix_ms: u128,
    pub pid: u32,
    pub memory: MemoryTelemetry,
    pub io: IoTelemetry,
    pub network: NetworkTelemetry,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct IoCounters {
    pub read_bytes: u64,
    pub write_bytes: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct IoSample {
    pub at: SystemTime,
    pub counters: IoCounters,
}

#[derive(Debug, Default)]
pub struct ProcessTelemetrySampler {
    previous_io: Mutex<Option<IoSample>>,
}

impl ProcessTelemetrySampler {
    pub fn sample(&self) -> ProcessTelemetryResponse {
        let now = SystemTime::now();
        let memory = match std::fs::read_to_string("/proc/self/status") {
            Ok(status) => match parse_status_memory(&status) {
                Some((resident_bytes, virtual_bytes)) => MemoryTelemetry::Available {
                    resident_bytes,
                    virtual_bytes,
                },
                None => MemoryTelemetry::Unavailable {
                    reason: "/proc/self/status did not contain VmRSS and VmSize".to_owned(),
                },
            },
            Err(e) => MemoryTelemetry::Unavailable {
                reason: format!("unable to read /proc/self/status: {e}"),
            },
        };

        let io = match std::fs::read_to_string("/proc/self/io") {
            Ok(io) => match parse_io_counters(&io) {
                Some(counters) => {
                    let current = IoSample { at: now, counters };
                    let previous = self
                        .previous_io
                        .lock()
                        .expect("process telemetry mutex poisoned")
                        .replace(current);
                    let (read_bytes_per_sec, write_bytes_per_sec) = previous
                        .map(|previous| calculate_io_rates(&previous, &current))
                        .unwrap_or((None, None));
                    IoTelemetry::Available {
                        read_bytes_per_sec,
                        write_bytes_per_sec,
                        total_read_bytes: counters.read_bytes,
                        total_write_bytes: counters.write_bytes,
                    }
                }
                None => IoTelemetry::Unavailable {
                    reason: "/proc/self/io did not contain read_bytes and write_bytes".to_owned(),
                },
            },
            Err(e) => IoTelemetry::Unavailable {
                reason: format!("unable to read /proc/self/io: {e}"),
            },
        };

        ProcessTelemetryResponse {
            sampled_at_unix_ms: now
                .duration_since(UNIX_EPOCH)
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

pub fn parse_status_memory(status: &str) -> Option<(u64, u64)> {
    let mut resident_bytes = None;
    let mut virtual_bytes = None;

    for line in status.lines() {
        if let Some(bytes) = parse_proc_kib_line(line, "VmRSS:") {
            resident_bytes = Some(bytes);
        } else if let Some(bytes) = parse_proc_kib_line(line, "VmSize:") {
            virtual_bytes = Some(bytes);
        }
    }

    Some((resident_bytes?, virtual_bytes?))
}

pub fn parse_io_counters(io: &str) -> Option<IoCounters> {
    let mut read_bytes = None;
    let mut write_bytes = None;

    for line in io.lines() {
        if let Some(value) = parse_proc_u64_line(line, "read_bytes:") {
            read_bytes = Some(value);
        } else if let Some(value) = parse_proc_u64_line(line, "write_bytes:") {
            write_bytes = Some(value);
        }
    }

    Some(IoCounters {
        read_bytes: read_bytes?,
        write_bytes: write_bytes?,
    })
}

pub fn calculate_io_rates(previous: &IoSample, current: &IoSample) -> (Option<u64>, Option<u64>) {
    let Ok(elapsed) = current.at.duration_since(previous.at) else {
        return (None, None);
    };
    let elapsed_nanos = elapsed.as_nanos();
    if elapsed_nanos == 0 {
        return (None, None);
    }

    let read_delta = current
        .counters
        .read_bytes
        .saturating_sub(previous.counters.read_bytes);
    let write_delta = current
        .counters
        .write_bytes
        .saturating_sub(previous.counters.write_bytes);

    (
        Some(bytes_per_second(read_delta, elapsed_nanos)),
        Some(bytes_per_second(write_delta, elapsed_nanos)),
    )
}

fn parse_proc_kib_line(line: &str, key: &str) -> Option<u64> {
    let rest = line.strip_prefix(key)?.trim();
    let value = rest.strip_suffix("kB")?.trim().parse::<u64>().ok()?;
    value.checked_mul(1024)
}

fn parse_proc_u64_line(line: &str, key: &str) -> Option<u64> {
    line.strip_prefix(key)?.trim().parse::<u64>().ok()
}

fn bytes_per_second(bytes: u64, elapsed_nanos: u128) -> u64 {
    let numerator = u128::from(bytes) * 1_000_000_000;
    ((numerator + (elapsed_nanos / 2)) / elapsed_nanos).min(u128::from(u64::MAX)) as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, UNIX_EPOCH};

    #[test]
    fn parses_process_memory_from_proc_status_kib() {
        let status = "Name:\tmoonfire-nvr\nVmSize:\t 5242880 kB\nVmRSS:\t 2097152 kB\n";

        assert_eq!(
            parse_status_memory(status),
            Some((2_147_483_648, 5_368_709_120))
        );
    }

    #[test]
    fn returns_none_when_process_memory_fields_are_missing() {
        let status = "Name:\tmoonfire-nvr\nVmRSS:\t 2097152 kB\n";

        assert_eq!(parse_status_memory(status), None);
    }

    #[test]
    fn parses_process_io_counters() {
        let io = "rchar: 1\nwchar: 2\nread_bytes: 12345\nwrite_bytes: 67890\n";

        assert_eq!(
            parse_io_counters(io),
            Some(IoCounters {
                read_bytes: 12_345,
                write_bytes: 67_890,
            })
        );
    }

    #[test]
    fn calculates_io_rates_from_two_samples() {
        let previous = IoSample {
            at: UNIX_EPOCH,
            counters: IoCounters {
                read_bytes: 1_000,
                write_bytes: 2_000,
            },
        };
        let current = IoSample {
            at: UNIX_EPOCH + Duration::from_secs(2),
            counters: IoCounters {
                read_bytes: 5_000,
                write_bytes: 12_000,
            },
        };

        assert_eq!(
            calculate_io_rates(&previous, &current),
            (Some(2_000), Some(5_000))
        );
    }

    #[test]
    fn returns_no_rates_for_zero_duration_samples() {
        let sample = IoSample {
            at: UNIX_EPOCH,
            counters: IoCounters {
                read_bytes: 1_000,
                write_bytes: 2_000,
            },
        };

        assert_eq!(calculate_io_rates(&sample, &sample), (None, None));
    }

    #[test]
    fn serializes_memory_fields_as_camel_case() {
        let json = serde_json::to_value(MemoryTelemetry::Available {
            resident_bytes: 1,
            virtual_bytes: 2,
        })
        .unwrap();

        assert_eq!(json["residentBytes"], 1);
        assert_eq!(json["virtualBytes"], 2);
        assert!(json.get("resident_bytes").is_none());
        assert!(json.get("virtual_bytes").is_none());
    }

    #[test]
    fn serializes_io_fields_as_camel_case() {
        let json = serde_json::to_value(IoTelemetry::Available {
            read_bytes_per_sec: Some(3),
            write_bytes_per_sec: Some(4),
            total_read_bytes: 5,
            total_write_bytes: 6,
        })
        .unwrap();

        assert_eq!(json["readBytesPerSec"], 3);
        assert_eq!(json["writeBytesPerSec"], 4);
        assert_eq!(json["totalReadBytes"], 5);
        assert_eq!(json["totalWriteBytes"], 6);
        assert!(json.get("read_bytes_per_sec").is_none());
        assert!(json.get("write_bytes_per_sec").is_none());
        assert!(json.get("total_read_bytes").is_none());
        assert!(json.get("total_write_bytes").is_none());
    }

    #[test]
    fn sampler_returns_process_telemetry_with_first_io_sample_unrated() {
        let sampler = ProcessTelemetrySampler::default();

        let response = sampler.sample();

        assert_eq!(response.pid, std::process::id());
        assert!(response.sampled_at_unix_ms > 0);
        assert!(matches!(
            response.network,
            NetworkTelemetry::Unavailable { ref reason }
                if reason == "process network counters are not available in the MVP"
        ));
        assert!(matches!(
            response.io,
            IoTelemetry::Available {
                read_bytes_per_sec: None,
                write_bytes_per_sec: None,
                ..
            }
        ));
    }
}
