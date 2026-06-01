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

/// Reads the `exp` claim from a JWT without verifying its signature.
///
/// We trust our own freshly-minted token, so this is a base64url decode of the
/// payload segment plus a JSON lookup. Returns `None` when the input isn't a
/// 3-part JWT or doesn't include an integer `exp`.
pub fn decode_exp(jwt: &str) -> Option<i64> {
    use base64::Engine;
    let parts: Vec<&str> = jwt.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    let payload_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(parts[1])
        .ok()?;
    let payload: serde_json::Value = serde_json::from_slice(&payload_bytes).ok()?;
    payload.get("exp").and_then(|v| v.as_i64())
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

    #[test]
    fn decode_exp_reads_payload() {
        // header.payload.sig where payload = {"exp":1700000000}
        // base64url-no-pad of {"exp":1700000000} is "eyJleHAiOjE3MDAwMDAwMDB9"
        let jwt = "header.eyJleHAiOjE3MDAwMDAwMDB9.sig";
        assert_eq!(decode_exp(jwt), Some(1_700_000_000));
    }

    #[test]
    fn decode_exp_returns_none_when_payload_has_no_exp() {
        // payload = {"sub":"x"} → "eyJzdWIiOiJ4In0"
        let jwt = "header.eyJzdWIiOiJ4In0.sig";
        assert_eq!(decode_exp(jwt), None);
    }

    #[test]
    fn decode_exp_returns_none_for_malformed_jwt() {
        assert_eq!(decode_exp("not.a.jwt"), None);
        assert_eq!(decode_exp("only_one_part"), None);
        assert_eq!(decode_exp("a.b"), None);
    }
}
