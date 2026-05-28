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
            bail!(
                Unauthenticated,
                msg("must have read_camera_configs permission")
            );
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
