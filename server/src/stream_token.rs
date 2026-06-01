// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2026 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception.

//! Dynamic RTSP stream-token provider.
//!
//! moonfire mints a short-lived JWT against the configured detai service-auth
//! endpoint at every RTSP `open()` so recording survives reconnects after the
//! static DB-stored token has expired.

use base::{bail, err, Error};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use async_trait::async_trait;
use tokio::sync::Mutex as AsyncMutex;

const REFRESH_SKEW_SEC: i64 = 300;

/// A freshly-minted MediaMTX stream token.
#[derive(Clone, Debug)]
pub struct MintedToken {
    pub jwt: String,
    pub exp_unix: i64,
}

/// What the streamer depends on. Wraps a `TokenMinter` plus a per-path cache.
#[async_trait]
pub trait TokenProvider: Send + Sync {
    /// Returns a token for `path`, minting (or reusing a cached one) as needed.
    /// `Ok(None)` is the "provider unconfigured" sentinel — the caller should
    /// then use the original URL unchanged.
    async fn token_for(&self, path: &str) -> Result<Option<String>, Error>;

    /// Drops any cached token for `path`. Called after an `open()` failure so
    /// the next attempt re-mints.
    fn invalidate(&self, path: &str);
}

/// The HTTP boundary, injectable for tests.
#[async_trait]
pub trait TokenMinter: Send + Sync {
    async fn mint(&self, path: &str) -> Result<MintedToken, Error>;
}

/// Caching `TokenProvider` that delegates the network call to a `TokenMinter`.
///
/// Two locks, mirroring the pattern in `external_mediamtx.rs`:
/// - `cache`: a sync `Mutex` so `invalidate` (sync per the trait) can drop
///   entries without `await`. Held only briefly — never across awaits.
/// - `mint_lock`: an async `Mutex` that serialises in-flight mints. With the
///   double-check-after-locking pattern below, concurrent reconnects for the
///   same path collapse to one upstream call.
pub struct DetaiServiceTokenProvider {
    minter: Box<dyn TokenMinter>,
    cache: Mutex<HashMap<String, MintedToken>>,
    mint_lock: AsyncMutex<()>,
}

impl DetaiServiceTokenProvider {
    pub fn new(minter: Box<dyn TokenMinter>) -> Self {
        Self {
            minter,
            cache: Mutex::new(HashMap::new()),
            mint_lock: AsyncMutex::new(()),
        }
    }

    fn cached_fresh(&self, path: &str, now: i64) -> Option<String> {
        let guard = self.cache.lock().unwrap();
        let existing = guard.get(path)?;
        if existing.exp_unix - now > REFRESH_SKEW_SEC {
            Some(existing.jwt.clone())
        } else {
            None
        }
    }
}

#[async_trait]
impl TokenProvider for DetaiServiceTokenProvider {
    async fn token_for(&self, path: &str) -> Result<Option<String>, Error> {
        let now = unix_now();
        if let Some(jwt) = self.cached_fresh(path, now) {
            return Ok(Some(jwt));
        }
        let _serialise = self.mint_lock.lock().await;
        // Double-check after acquiring the mint lock in case another caller
        // minted while we were waiting.
        if let Some(jwt) = self.cached_fresh(path, unix_now()) {
            return Ok(Some(jwt));
        }
        let minted = self.minter.mint(path).await?;
        let jwt = minted.jwt.clone();
        self.cache.lock().unwrap().insert(path.to_owned(), minted);
        Ok(Some(jwt))
    }

    fn invalidate(&self, path: &str) {
        self.cache.lock().unwrap().remove(path);
    }
}

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

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

/// Returns the MediaMTX path portion of an RTSP URL — i.e. `url.path()` with
/// surrounding slashes trimmed. Internal slashes (nested paths) are preserved.
pub fn path_from_url(url: &url::Url) -> String {
    url.path().trim_matches('/').to_owned()
}

/// Renders a URL for logging with the `token` query value replaced by
/// `<redacted>`. Other query parameters are preserved verbatim.
pub fn redact_token_in_url(url: &url::Url) -> String {
    let Some(query) = url.query() else {
        return url.as_str().to_owned();
    };
    let mut found = false;
    let parts: Vec<String> = query
        .split('&')
        .map(|pair| {
            let key = pair.split('=').next().unwrap_or("");
            if key == "token" {
                found = true;
                "token=<redacted>".to_string()
            } else {
                pair.to_string()
            }
        })
        .collect();
    if !found {
        return url.as_str().to_owned();
    }
    let new_query = parts.join("&");
    // Reconstruct the URL string preserving the literal redaction marker
    // (set_query / query_pairs_mut would percent-encode the angle brackets).
    let raw = url.as_str();
    let q_start = raw.find('?').expect("query() returned Some, so '?' must be present");
    let fragment = raw.find('#').map(|i| &raw[i..]).unwrap_or("");
    format!("{}?{}{}", &raw[..q_start], new_query, fragment)
}

/// Returns a copy of `base` with `token=<tok>` set as a query parameter,
/// replacing any existing `token` and preserving all other parameters.
pub fn with_token(base: &url::Url, tok: &str) -> url::Url {
    let kept: Vec<(String, String)> = base
        .query_pairs()
        .filter(|(k, _)| k != "token")
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect();
    let mut out = base.clone();
    {
        let mut q = out.query_pairs_mut();
        q.clear();
        for (k, v) in &kept {
            q.append_pair(k, v);
        }
        q.append_pair("token", tok);
    }
    out
}

/// Real `TokenMinter` that POSTs to the configured detai service-auth endpoint.
pub struct HttpTokenMinter {
    client: reqwest::Client,
    url: String,
    client_id: String,
    client_secret: String,
    ttl_sec: u32,
}

impl HttpTokenMinter {
    pub fn new(url: String, client_id: String, client_secret: String, ttl_sec: u32) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .expect("reqwest client with timeout should build");
        Self {
            client,
            url,
            client_id,
            client_secret,
            ttl_sec,
        }
    }
}

#[async_trait]
impl TokenMinter for HttpTokenMinter {
    async fn mint(&self, path: &str) -> Result<MintedToken, Error> {
        let body = serde_json::json!({
            "clientId": self.client_id,
            "clientSecret": self.client_secret,
            "permissions": [{"action": "read", "path": path}],
            "expiresInSeconds": self.ttl_sec,
        });
        let resp = self
            .client
            .post(&self.url)
            .json(&body)
            .send()
            .await
            .map_err(|e| err!(Unknown, source(e), msg("token POST failed")))?;
        let status = resp.status();
        let text = resp
            .text()
            .await
            .map_err(|e| err!(Unknown, source(e), msg("token response body read failed")))?;
        if !status.is_success() {
            bail!(Unknown, msg("token service returned HTTP {}", status));
        }
        let jwt = parse_token_response(&text)?;
        let exp_unix = decode_exp(&jwt)
            .ok_or_else(|| err!(Unknown, msg("minted token has no exp claim")).build())?;
        Ok(MintedToken { jwt, exp_unix })
    }
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

    #[test]
    fn with_token_inserts_when_absent() {
        let base = url::Url::parse("rtsp://10.20.0.254:8554/vtd-vqh-cam-1-main").unwrap();
        let result = with_token(&base, "newjwt");
        assert_eq!(
            result.as_str(),
            "rtsp://10.20.0.254:8554/vtd-vqh-cam-1-main?token=newjwt"
        );
    }

    #[test]
    fn with_token_replaces_when_present() {
        let base = url::Url::parse("rtsp://h/p?token=oldjwt").unwrap();
        let result = with_token(&base, "newjwt");
        assert_eq!(result.as_str(), "rtsp://h/p?token=newjwt");
    }

    #[test]
    fn with_token_preserves_other_params() {
        let base = url::Url::parse("rtsp://h/p?foo=bar&token=old&baz=qux").unwrap();
        let result = with_token(&base, "newjwt");
        // Order: non-token params kept in their original order, token re-appended last.
        assert_eq!(result.as_str(), "rtsp://h/p?foo=bar&baz=qux&token=newjwt");
    }

    #[test]
    fn path_from_url_strips_leading_and_trailing_slashes() {
        let u = url::Url::parse("rtsp://h:8554/vtd-vqh-cam-1-main").unwrap();
        assert_eq!(path_from_url(&u), "vtd-vqh-cam-1-main");
    }

    #[test]
    fn path_from_url_handles_trailing_slash() {
        let u = url::Url::parse("rtsp://h:8554/cam1/").unwrap();
        assert_eq!(path_from_url(&u), "cam1");
    }

    #[test]
    fn path_from_url_preserves_internal_slashes_for_nested_paths() {
        let u = url::Url::parse("rtsp://h:8554/live/cam1").unwrap();
        assert_eq!(path_from_url(&u), "live/cam1");
    }

    #[test]
    fn redact_token_in_url_replaces_value_only() {
        let u = url::Url::parse("rtsp://h/p?foo=bar&token=secretsecret").unwrap();
        assert_eq!(redact_token_in_url(&u), "rtsp://h/p?foo=bar&token=<redacted>");
    }

    #[test]
    fn redact_token_in_url_passthrough_when_no_token_param() {
        let u = url::Url::parse("rtsp://h/p?foo=bar").unwrap();
        assert_eq!(redact_token_in_url(&u), "rtsp://h/p?foo=bar");
    }

    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Mutex as StdMutex;

    struct FakeMinter {
        responses: StdMutex<Vec<Result<MintedToken, &'static str>>>,
        calls: AtomicU32,
        delay_ms: u64,
    }

    impl FakeMinter {
        fn new(responses: Vec<Result<MintedToken, &'static str>>) -> Self {
            Self {
                responses: StdMutex::new(responses),
                calls: AtomicU32::new(0),
                delay_ms: 0,
            }
        }
        fn with_delay(mut self, ms: u64) -> Self {
            self.delay_ms = ms;
            self
        }
        fn calls(&self) -> u32 {
            self.calls.load(Ordering::SeqCst)
        }
    }

    #[async_trait]
    impl TokenMinter for FakeMinter {
        async fn mint(&self, _path: &str) -> Result<MintedToken, Error> {
            if self.delay_ms > 0 {
                tokio::time::sleep(std::time::Duration::from_millis(self.delay_ms)).await;
            }
            self.calls.fetch_add(1, Ordering::SeqCst);
            let mut q = self.responses.lock().unwrap();
            assert!(!q.is_empty(), "FakeMinter ran out of canned responses");
            match q.remove(0) {
                Ok(t) => Ok(t),
                Err(msg) => bail!(Unknown, msg("{}", msg)),
            }
        }
    }

    fn fresh(jwt: &str) -> MintedToken {
        MintedToken {
            jwt: jwt.to_owned(),
            exp_unix: unix_now() + 86_400,
        }
    }

    fn near_expiry(jwt: &str) -> MintedToken {
        // exp within REFRESH_SKEW_SEC → must trigger re-mint on the next call.
        MintedToken {
            jwt: jwt.to_owned(),
            exp_unix: unix_now() + 100,
        }
    }

    #[tokio::test]
    async fn token_for_mints_on_miss_then_caches() {
        let minter = FakeMinter::new(vec![Ok(fresh("j1"))]);
        let provider = DetaiServiceTokenProvider::new(Box::new(minter));
        assert_eq!(provider.token_for("p").await.unwrap().as_deref(), Some("j1"));
        assert_eq!(provider.token_for("p").await.unwrap().as_deref(), Some("j1"));
        // Only one mint despite two calls.
    }

    #[tokio::test]
    async fn token_for_remints_when_within_refresh_skew() {
        let minter = FakeMinter::new(vec![Ok(near_expiry("j1")), Ok(fresh("j2"))]);
        let provider = DetaiServiceTokenProvider::new(Box::new(minter));
        assert_eq!(provider.token_for("p").await.unwrap().as_deref(), Some("j1"));
        // Cached token's exp is within the skew → re-mint.
        assert_eq!(provider.token_for("p").await.unwrap().as_deref(), Some("j2"));
    }

    #[tokio::test]
    async fn invalidate_forces_re_mint() {
        let minter = FakeMinter::new(vec![Ok(fresh("j1")), Ok(fresh("j2"))]);
        let provider = DetaiServiceTokenProvider::new(Box::new(minter));
        provider.token_for("p").await.unwrap();
        provider.invalidate("p");
        assert_eq!(provider.token_for("p").await.unwrap().as_deref(), Some("j2"));
    }

    #[tokio::test]
    async fn distinct_paths_are_cached_independently() {
        let minter = FakeMinter::new(vec![Ok(fresh("a")), Ok(fresh("b"))]);
        let provider = DetaiServiceTokenProvider::new(Box::new(minter));
        assert_eq!(provider.token_for("alpha").await.unwrap().as_deref(), Some("a"));
        assert_eq!(provider.token_for("beta").await.unwrap().as_deref(), Some("b"));
        // Re-fetching either should hit cache, not mint a third time.
        assert_eq!(provider.token_for("alpha").await.unwrap().as_deref(), Some("a"));
        assert_eq!(provider.token_for("beta").await.unwrap().as_deref(), Some("b"));
    }

    #[tokio::test]
    async fn concurrent_token_for_same_path_collapses_to_one_mint() {
        // FakeMinter sleeps briefly so the second concurrent call lands while
        // the first is still inside mint(). With a single async lock around the
        // cache, the second call awaits the lock, sees the cached value, and
        // returns without minting.
        let minter = Arc::new(FakeMinter::new(vec![Ok(fresh("j1"))]).with_delay(50));
        // We need two references to the same provider; build it with an Arc.
        struct ArcMinter(Arc<FakeMinter>);
        #[async_trait]
        impl TokenMinter for ArcMinter {
            async fn mint(&self, path: &str) -> Result<MintedToken, Error> {
                self.0.mint(path).await
            }
        }
        let provider = Arc::new(DetaiServiceTokenProvider::new(Box::new(ArcMinter(minter.clone()))));
        let p1 = provider.clone();
        let p2 = provider.clone();
        let (a, b) = tokio::join!(
            async move { p1.token_for("p").await.unwrap() },
            async move { p2.token_for("p").await.unwrap() }
        );
        assert_eq!(a.as_deref(), Some("j1"));
        assert_eq!(b.as_deref(), Some("j1"));
        assert_eq!(minter.calls(), 1, "herd not collapsed");
    }

    #[tokio::test]
    async fn minter_error_propagates_and_caches_nothing() {
        let minter = FakeMinter::new(vec![Err("boom"), Ok(fresh("j1"))]);
        let provider = DetaiServiceTokenProvider::new(Box::new(minter));
        assert!(provider.token_for("p").await.is_err());
        // Cache is empty, so the next call mints again.
        assert_eq!(provider.token_for("p").await.unwrap().as_deref(), Some("j1"));
    }
}
