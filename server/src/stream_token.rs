// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2026 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

//! Dynamic RTSP stream-token provider.
//!
//! moonfire mints a short-lived JWT against the configured detai service-auth
//! endpoint at every RTSP `open()` so recording survives reconnects after the
//! static DB-stored token has expired.

use base::{bail, err, Error};

/// Extracts the JWT from a token-service response body.
///
/// The verified shape is `{ "access_token": "<jwt>", ... }`. Falls back to a
/// bare-string body if the response is not JSON. Errors if no JWT is present.
pub fn parse_token_response(body: &str) -> Result<String, Error> {
    let trimmed = body.trim();
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
        if let Some(jwt) = value.get("access_token").and_then(|v| v.as_str()) {
            if !jwt.is_empty() {
                return Ok(jwt.to_owned());
            }
        }
        // JSON parsed but had no access_token field — don't fall through to the
        // bare-string path; that would be misleading.
        bail!(
            Unknown,
            msg("token response JSON has no access_token field")
        );
    }
    if looks_like_jwt(trimmed) {
        return Ok(trimmed.to_owned());
    }
    bail!(Unknown, msg("token response is neither JSON nor a JWT"))
}

fn looks_like_jwt(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    parts.len() == 3 && parts.iter().all(|p| !p.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_token_response_reads_access_token_field() {
        let body = r#"{"access_token":"head.payload.sig","token_type":"Bearer","expires_in":86400}"#;
        assert_eq!(parse_token_response(body).unwrap(), "head.payload.sig");
    }

    #[test]
    fn parse_token_response_falls_back_to_bare_jwt_string() {
        let body = "head.payload.sig";
        assert_eq!(parse_token_response(body).unwrap(), "head.payload.sig");
    }

    #[test]
    fn parse_token_response_errors_on_json_without_access_token() {
        let body = r#"{"token_type":"Bearer","expires_in":86400}"#;
        assert!(parse_token_response(body).is_err());
    }

    #[test]
    fn parse_token_response_errors_on_garbage() {
        let body = "not a token";
        assert!(parse_token_response(body).is_err());
    }
}
