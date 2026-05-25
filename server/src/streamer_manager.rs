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
use tracing::Instrument;
use tracing::{info, warn};

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
        // Tear down all RTSP sessions.
        for (_, group) in self.session_groups.drain() {
            if let Err(err) = group.await_teardown().await {
                tracing::error!(%err, "teardown failed");
            }
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
        // Use the current number of running streams as an index to distribute rotation times.
        // This gives each new stream a different offset (mod ROTATE_INTERVAL_SEC).
        let rotate_offset_sec = (self.handles.len() as i64) % streamer::ROTATE_INTERVAL_SEC;
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
    use base::clock::RealClocks;
    use tokio::sync::mpsc;

    #[tokio::test]
    async fn manager_exits_when_sender_dropped() {
        // When the sender is dropped, run() should return (after stopping all streams).
        let tdb = db::testutil::TestDb::new(RealClocks {}).await;
        let db = tdb.db.clone();
        let env: &'static streamer::Environment<'static, clock::RealClocks> =
            Box::leak(Box::new(streamer::Environment {
                clocks: clock::RealClocks {},
                sample_entries: db.lock().sample_entries().clone(),
                opener: &crate::stream::OPENER,
                shutdown_rx: tdb.shutdown_rx.clone(),
            }));
        let (tx, rx) = mpsc::channel(8);
        let mgr = StreamerManager::new(db.clone(), env, rx);
        let task = tokio::spawn(mgr.run());
        drop(tx); // close the channel
        tokio::time::timeout(std::time::Duration::from_secs(2), task)
            .await
            .expect("manager did not exit within timeout")
            .expect("manager panicked");
        drop(tdb);
    }
}
