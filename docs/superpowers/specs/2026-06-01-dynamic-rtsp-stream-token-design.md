# Dynamic RTSP Stream Token Provider Design

**Date:** 2026-06-01
**Status:** Draft, pending review

## Problem

moonfire stores each stream's RTSP URL — including an embedded JWT `?token=` —
statically in the DB. The token is short-lived (24h) and is validated by
MediaMTX only at RTSP **session setup**, never per-packet. Consequently:

- A live session keeps recording for days after its token expires.
- But any reconnect (network blip, camera reboot, MediaMTX restart, or an admin
  `RestartStream`) re-opens the session with the stale token; MediaMTX rejects
  `DESCRIBE` with `401 Unauthorized` and the streamer drops into a ~3s
  retry loop. Recording stops.

Additionally, the signing authority moved: MediaMTX now verifies against the
JWKS at `http://10.20.0.254:18090/.well-known/jwks.json` (kid `019e8140…`),
while the old tokens were signed by `18081` (kid `44ca5dc8…`). Stale tokens
therefore fail on **two** counts: expiry and wrong kid.

cam-1 recording is currently down for exactly this reason (an admin
`RestartStream` re-opened the session with an already-expired token).

## Verified facts (2026-06-01)

A live probe with real credentials (`clientId=moonfire`) confirmed:

- `POST http://10.20.0.254:18090/api/service-auth/token` with body
  `{clientId, clientSecret, permissions:[{action,path}], expiresInSeconds}` →
  HTTP 200.
- Response is **OAuth2-flat**: `{ "access_token": "<JWT>", "token_type":
  "Bearer", "expires_in": 86400 }`. (NOT the `{success, data}` envelope the
  MediaMTX broker design assumed — the token parser must read `access_token`.)
- The minted JWT's `kid` = `019e8140e1bd7e66892479832dd92282`, which **matches**
  the JWKS MediaMTX trusts → tokens minted here will be accepted.
- Claims: `iss: d2.detai`, `aud: mediamtx`,
  `mediamtx_permissions: [{action:"read", path:"vtd-vqh-cam-1-main"}]` —
  matching MediaMTX's configured `authJWTClaimKey = mediamtx_permissions`.

## Decision

moonfire mints its own stream tokens directly from 18090 at connect time,
rather than relying on a static token in the DB or the (not-yet-built) MediaMTX
broker. This is independent of the MediaMTX broker design (that broker serves
browser playback); the recording path needs its own token regardless.

**Mint-at-connect, no background timer.** Because MediaMTX only checks the token
at session setup, minting a fresh token on every `open()`/reconnect is
sufficient and simplest. A per-path cache (with decoded `exp`) avoids hammering
the auth server during reconnect storms.

## Components

### New: `server/src/stream_token.rs`

Two seams so the HTTP boundary is isolated and the cache logic is testable
without a network or a new dev-dependency:

```rust
#[async_trait]
trait TokenProvider: Send + Sync {            // what the streamer depends on
    async fn token_for(&self, path: &str) -> Result<Option<String>, Error>;
    fn invalidate(&self, path: &str);
}

#[async_trait]
trait TokenMinter: Send + Sync {              // the network boundary, injectable
    async fn mint(&self, path: &str) -> Result<MintedToken, Error>; // {jwt, exp_unix}
}
```

Plus two pure, directly-unit-testable functions:

- `parse_token_response(body: &str) -> Result<String, Error>` — extracts the JWT
  from the **verified** shape `{ "access_token": "<jwt>", ... }`; falls back to a
  bare-string body; errors if none.
- `decode_exp(jwt: &str) -> Option<i64>` — base64url-decodes the JWT payload and
  reads `exp` (no signature check; we trust our own freshly-minted token).

`HttpTokenMinter` (the real `TokenMinter`): POSTs `{clientId, clientSecret,
permissions:[{action:"read", path}], expiresInSeconds}` to the configured URL
with `reqwest`, then `parse_token_response` + `decode_exp`.

`DetaiServiceTokenProvider`:

- Holds a `Box<dyn TokenMinter>` + a `Mutex<HashMap<String, MintedToken>>` cache.
- `token_for(path)`: returns the cached token if present and not within a refresh
  skew (300s) of `exp`; otherwise mints, caches per-path, returns it. A single
  async mutex serialises minting so concurrent reconnects (main+sub, or a
  reconnect storm) collapse to one upstream call per path rather than a herd.
- `invalidate(path)`: drops the cached entry (called after an open failure so the
  next attempt re-mints).
- **Not configured** (any of URL/ID/secret empty) → constructed as `None` at the
  call site (see run wiring); the streamer then uses the stored URL unchanged, so
  dev/no-broker setups keep working.
- The secret lives only in the process environment. Never written to the DB,
  source, or logs.

### Config: `StreamTokenConfig` (sibling struct in `stream_token.rs`)

A dedicated struct, **not** folded into `ExternalMediaMtxConfig` — the two use
different auth models (this one is client-credentials against `18090`; the
existing monitoring service does username/password login against `18081`
`/api/Jwks/stream-token`). Reusing that struct would conflate two servers and
two flows.

```rust
struct StreamTokenConfig {
    url: Option<String>,        // DETAI_SERVICE_TOKEN_URL
    client_id: Option<String>,  // DETAI_CLIENT_ID
    client_secret: Option<String>, // DETAI_CLIENT_SECRET
    ttl_sec: u32,               // DETAI_TOKEN_TTL_SEC, default 86400
}
```
`from_env()` mirrors the existing `env_nonempty` helper.

### Changed: `server/src/streamer.rs`

- `Environment` gains `token_provider: Option<Arc<dyn TokenProvider>>`.
- In `run_once`, before `opener.open(...)`:
  1. Derive the MediaMTX path = `self.url`'s path component with leading/trailing
     slashes trimmed (`/vtd-vqh-cam-1-main` → `vtd-vqh-cam-1-main`; nested
     `/live/cam1` → `live/cam1`). This is the **full** path, not just the last
     segment — MediaMTX authorizes the token's `path` claim against the whole
     path, and the minted permission must match it exactly.
  2. If a provider is present and returns `Some(tok)`, build the open URL via
     `with_token(&self.url, &tok)`; otherwise use `self.url` unchanged.
  3. On open error, call `provider.invalidate(path)` before returning the error
     so the streamer's existing retry re-mints.
- `with_token(base, tok)`: set/replace the `token` query param, preserving other
  params. Pure function, unit-tested.
- **Redact tokens in logs.** The current `info!(url = %self.url, "opening
  input")` logs the full JWT (observed repeatedly in container logs). Replace
  with a redacted rendering (`token=<redacted>`). Fixes a pre-existing leak in
  the line being modified.

### Changed: `server/src/cmds/run/mod.rs`

- Build the provider from env once at startup; store
  `Some(Arc::new(provider))` (or `None` if unconfigured) in `Environment`.

### Config

Add the service-token fields to `ExternalMediaMtxConfig` (which already reads
`DETAI_*` / `MEDIAMTX_*` env vars) or a small sibling config struct. The backend
container already sets `MEDIAMTX_API_URL`; deployment adds the three new vars.

## Error handling

| Condition | Behaviour |
|---|---|
| Provider unconfigured | `token_for` → `Ok(None)`; URL used as-is |
| Mint HTTP non-2xx / unreachable | `token_for` → `Err`; streamer logs, sleeps 1s, retries (existing loop) |
| Body has no `access_token` | `Err` (same retry path) |
| `open()` fails while using a token | `invalidate(path)`; next attempt re-mints |

No new crash paths; every failure folds into the streamer's existing
retry-after-error loop.

## Testing (TDD)

**Pure functions** — no I/O, direct asserts:

- `parse_token_response`: extracts the JWT from `{access_token:"<jwt>", ...}`;
  bare-string fallback; errors on a body with no token; errors on malformed JSON.
- `decode_exp`: returns `exp` from a hand-built unsigned JWT; `None` on a
  non-3-part string or a payload without `exp`.

**Provider (`DetaiServiceTokenProvider`)** — against a **fake `TokenMinter`**
(an in-test struct counting calls), so no HTTP and no new dev-dependency:

- mint-on-miss then cache reuse: two `token_for(path)` within TTL → exactly one
  `mint` call;
- a cached token within the refresh skew of `exp` triggers a re-mint;
- `invalidate(path)` forces the next `token_for` to re-mint;
- distinct paths are cached independently;
- concurrent `token_for` for the same path collapse to one `mint` call (herd
  control);
- a minter error propagates as `Err` and caches nothing.

**URL rewrite** — `with_token`: inserts when the param is absent; replaces when
present; preserves other query params; correct path-segment extraction for
trailing-slash and nested paths.

**Streamer** — extend the existing `MockOpener` test:

- with a fake `TokenProvider`, the opened URL carries the minted token;
- a `None` provider leaves the URL unchanged (the existing `basic()` test stays
  green, since its URL has no token);
- after an `open()` error, `invalidate` is called and the next attempt re-mints.

`HttpTokenMinter` itself is a thin wrapper (build request → `parse_token_response`
→ `decode_exp`); its logic is covered by the pure-function tests above. It was
also validated end-to-end against the live `18090` server during design (see
"Verified facts"), so no networked unit test is added.

## Deployment / verification

1. Build in-container (`--features bundled`, `VERSION` env set), as before.
2. Set `DETAI_SERVICE_TOKEN_URL`, `DETAI_CLIENT_ID`, `DETAI_CLIENT_SECRET` on the
   backend container (recreate it with `-e` flags, preserving the mounts/cmd
   captured via `docker inspect`).
3. Restart; confirm cam-1: no `401 DESCRIBE` in logs, the record file grows,
   recording resumes — and that it survives a forced `RestartStream`.

## Out of scope

- The MediaMTX-side broker (`/v3/stream-token`) — separate, serves browser
  playback.
- Locking down the open MediaMTX `/v3/` API — pre-existing condition, separate
  task.
- Refreshing a token mid-session — unnecessary; MediaMTX does not re-check live
  sessions.
