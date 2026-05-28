// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

use crate::{
    json,
    streamer_manager::StreamerCommand,
    web::{
        into_json_body, parse_json_body, plain_response, require_csrf_if_session, serve_json,
        Caller, ResponseResult, Service,
    },
};
use base::{bail, err};
use db::{self, StreamType};
use http::{Method, Request, StatusCode};
use std::sync::Arc;

impl Service {
    pub(super) async fn cameras_admin(
        self: Arc<Self>,
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
                            sample_file_dir_id: locked.sample_file_dir.as_ref().map(|d| d.id),
                            retain_bytes: locked.config.retain_bytes,
                            flush_if_sec: locked.config.flush_if_sec,
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
        self: Arc<Self>,
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
        self: Arc<Self>,
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
        self: Arc<Self>,
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
        // Use a block so the lock is fully out of scope before any .await.
        let stream_ids: Vec<i32> = {
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
            l.cameras_by_id()
                .get(&camera_id)
                .ok_or_else(|| err!(Internal, msg("camera vanished after update")))?
                .streams
                .iter()
                .flatten()
                .cloned()
                .collect()
        }; // l dropped here
        if let Some(tx) = self.streamer_tx.as_ref() {
            for stream_id in stream_ids {
                let _ = tx.send(StreamerCommand::RestartStream(stream_id)).await;
            }
        }
        Ok(plain_response(StatusCode::NO_CONTENT, ""))
    }

    async fn delete_camera(
        self: Arc<Self>,
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
        self: Arc<Self>,
        req: Request<hyper::body::Incoming>,
        caller: Caller,
        camera_id: i32,
        type_: StreamType,
    ) -> ResponseResult {
        if *req.method() != Method::PUT {
            return Ok(plain_response(
                StatusCode::METHOD_NOT_ALLOWED,
                "PUT expected",
            ));
        }
        if !caller.permissions.admin_users {
            bail!(Unauthenticated, msg("must have admin_users permission"));
        }
        let (_, b) = into_json_body(req).await?;
        let r: json::PutCameraStreamRequest = parse_json_body(&b)?;
        require_csrf_if_session(&caller, r.csrf.as_deref())?;
        if matches!(r.retain_bytes, Some(v) if v < 0) {
            bail!(InvalidArgument, msg("retainBytes must not be negative"));
        }
        // Use a block so the lock is fully out of scope before any .await.
        let (cmd_opt, retention_limit): (Option<StreamerCommand>, Option<db::lifecycle::NewLimit>) = {
            let mut l = self.db.lock();
            let mut change = l.null_camera_change(camera_id)?;
            let si = type_.index();
            let old_retain_bytes = change.streams[si].config.retain_bytes;
            change.streams[si].config.mode = r.mode.clone();
            change.streams[si].config.url = r.rtsp_url;
            change.streams[si].config.rtsp_transport = r.rtsp_transport;
            if let Some(retain_bytes) = r.retain_bytes {
                change.streams[si].config.retain_bytes = retain_bytes;
            }
            if let Some(flush_if_sec) = r.flush_if_sec {
                change.streams[si].config.flush_if_sec = flush_if_sec;
            }
            if let Some(dir_id) = r.sample_file_dir_id {
                if l.sample_file_dirs_by_id().get(&dir_id).is_none() {
                    bail!(NotFound, msg("no such sample file dir {dir_id}"));
                }
                change.streams[si].sample_file_dir_id = Some(dir_id);
            }
            l.update_camera(camera_id, change)?;
            let mode = r.mode.clone();
            let stream_id_opt = l
                .cameras_by_id()
                .get(&camera_id)
                .ok_or_else(|| err!(Internal, msg("camera vanished after stream update")))?
                .streams[si];
            let cmd = stream_id_opt.map(|stream_id| {
                if mode == db::json::STREAM_MODE_RECORD {
                    StreamerCommand::RestartStream(stream_id)
                } else {
                    StreamerCommand::StopStream(stream_id)
                }
            });
            let retention_limit = match (stream_id_opt, r.retain_bytes) {
                (Some(stream_id), Some(limit)) if limit < old_retain_bytes => {
                    Some(db::lifecycle::NewLimit { stream_id, limit })
                }
                _ => None,
            };
            (cmd, retention_limit)
        }; // l dropped here
        if let Some(limit) = retention_limit {
            db::lifecycle::lower_retention(&self.db, &[limit]).await?;
        }
        if let Some(tx) = self.streamer_tx.as_ref() {
            if let Some(cmd) = cmd_opt {
                let _ = tx.send(cmd).await;
            }
        }
        Ok(plain_response(StatusCode::NO_CONTENT, ""))
    }
}
