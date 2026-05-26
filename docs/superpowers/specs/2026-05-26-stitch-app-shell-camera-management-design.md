# Stitch App Shell and Camera Management Redesign

## Goal

Redesign Moonfire NVR's frontend shell and the Cameras page to closely match the Stitch reference screen for "Camera Management - Moonfire NVR" in project `17174465272393731395`. The first implementation target is `/cameras`; the shared shell should wrap existing routes so the rest of the app can migrate incrementally.

## Reference

- Stitch project: `17174465272393731395`
- Target screen: `Camera Management - Moonfire NVR`
- Visual style: dark modern utilitarian dashboard, Fire Orange primary actions, compact surveillance-control layout, high-contrast status and stream indicators.

## Scope

### In scope

- Add a shared dark app shell used around existing routes.
- Migrate `/cameras` to match the Stitch camera management screen as the golden reference.
- Restyle the add/edit camera dialog to match the same dark design system.
- Preserve existing camera CRUD behavior and API calls.
- Keep existing Live, Archive, Dashboard, and Settings page internals functional inside the new shell.

### Out of scope for this pass

- Pixel-close redesign of Live, Archive, Dashboard, and Settings page contents.
- New backend metrics for storage status, system health, alerts, or live camera health.
- PTZ controls, stream health monitoring, or video preview tiles.
- Authentication/user-profile implementation beyond static shell affordances.

## Design system

Use the Stitch dark system as the frontend visual baseline:

- Background: deep dark `#131313` with subtle panel layering.
- Surfaces: `#1c1b1b`, `#201f1f`, `#2a2a2a`, `#353534` depending on elevation.
- Primary: Fire Orange `#ff5722` for primary buttons, active nav, recording badges, and focus states.
- Text: high-contrast off-white for primary text, muted warm gray for secondary metadata.
- Borders: subtle 1px outline using warm dark browns/grays.
- Radius: compact 4px base radius.
- Typography: Inter for UI text; JetBrains Mono or monospace fallback for IP addresses, technical IDs, and compact numeric chips.

If adding a MUI theme is simpler than replacing MUI, use a dark MUI theme plus targeted `sx` styles for the pixel-close parts. Avoid broad rewrites of unrelated components.

## Shared app shell

Create a reusable shell around the app routes.

### Topbar

- Full-width dark topbar, approximately 64-80px high.
- Left: `Moonfire NVR` wordmark in large warm/primary-tinted text.
- Middle-left: search input styled like the reference, placeholder `Search cameras...`.
- Right: compact icon buttons for notifications, settings, and user/profile.
- Icons may be MUI icons if already available or simple existing icon primitives; visual weight should match the Stitch screen.

### Sidebar

- Fixed desktop sidebar around 280px wide.
- Brand block with orange camera tile, `Moonfire NVR`, and a small version/status line.
- Nav groups:
  - Main: Dashboard, Live View, Archive.
  - System: Settings, Cameras.
- Active Cameras nav item uses Fire Orange filled background and a thin left accent edge.
- Bottom area includes an orange `Export Clip` CTA and secondary Support / Log Out items.
- For this pass, Support/Log Out can be inert visual items if no existing behavior exists.

### Content area

- Content area sits to the right of the sidebar and below the topbar.
- Use desktop padding around 24-32px.
- Existing non-Cameras pages render inside the content area without redesigning their internals.
- The shell should not break existing route behavior.

## Cameras page

The Cameras page should become the first pixel-close implementation of the Stitch screen.

### Header

- Title: `Camera Management`.
- Subtitle: `Configure and manage connected IP cameras`.
- Right-aligned primary `Add Camera` button with plus icon and orange fill.

### Stats cards

Render four cards matching the reference layout:

1. Total Cameras: API camera count, zero-padded to two digits when reasonable.
2. Storage Status: placeholder `—` until backend storage metrics exist.
3. System Health: placeholder `—` until backend health metrics exist.
4. Alerts (24h): placeholder `—` until backend alert metrics exist.

Do not invent fake production metrics. Placeholder cards should keep the layout visually close without implying real data.

### Camera table

Render a dark bordered table/card with header row and camera rows.

Columns:

- Status
- Camera Name/Description
- IP Address
- Streams
- Storage Dir
- Actions

Mapping from current API data:

- Camera Name/Description: `shortName` and `description`.
- IP Address: derive from `onvifBaseUrl` host or first stream RTSP URL host when available; otherwise show `—`.
- Streams: show MAIN/SUB/EXT badges using stream type and mode. `record` should use orange REC styling; off/empty should use muted styling.
- Storage Dir: show stream sample file dir id if available as `Dir #<id>`; otherwise `—` until backend returns path names.
- Status: use best-effort visual state from available data. If any stream is `record`, display Online/green; otherwise Offline/red or Unknown/muted. Do not claim live connectivity without backend health.

Rows should match the reference density: dark alternating surface, subtle red tint for offline/error-like rows, mono IP chips, compact badges, and warm outline dividers.

### Actions

- Edit opens the add/edit dialog.
- Delete uses existing delete behavior and confirmation if already present; otherwise keep current delete flow.
- Additional tuning/settings icon can be visual-only for now unless there is existing behavior to wire.

## Add/Edit camera dialog

Restyle the existing `AddEditDialog` to match the dark shell and avoid the current long default-MUI form.

### Layout

- Dark modal surface with subtle outline, compact radius, and no light Material default background.
- Header includes `Add Camera` or `Edit Camera — <shortName>` and optional short helper text.
- Body is divided into clear sections:
  - Camera Details
  - Stream Configuration
- Footer actions stay visible at the bottom: ghost Cancel and orange Save Changes.

### Camera details fields

- Short Name
- Description
- ONVIF Base URL
- Username
- Password with show/hide affordance

Inputs use dark background, 1px border, orange focus border, and compact height.

### Stream configuration

- MAIN / SUB / EXT tabs styled to match the Stitch system.
- Only render the active stream panel. Do not render hidden panels for all three streams in the vertical layout, because that creates the long form shown in the current screenshot.
- Active panel fields:
  - Mode: Record / Off
  - RTSP URL
  - Transport: Auto / TCP / UDP
  - Sample File Dir ID
- RTSP URL and technical IDs should use mono styling where practical.

### Behavior

- Preserve existing create/update API calls.
- Preserve validation for required short name.
- On save success: close dialog and refresh camera list.
- On failure: show snackbar/toast with the existing error message behavior.

## Data flow

- The shared shell owns layout and navigation presentation only.
- Cameras page continues to call camera admin API functions from `ui/src/api.ts`.
- Add/edit dialog keeps local form state and calls existing create/update functions.
- The UI should remain compatible with the temporary dev setup where Vite proxies `/api` to a backend selected by `PROXY_TARGET`.

## Error handling

- If camera list loading fails, show a dark error panel/snackbar that matches the shell style.
- If placeholder metrics are unavailable, show `—` instead of fake values.
- If IP/storage fields cannot be derived from API data, show `—`.
- Delete and save failures use existing snackbar flow but styled consistently with the dark theme where possible.

## Testing and verification

- Run frontend typecheck/build or the project's existing UI verification command.
- Run relevant unit tests if present.
- Launch the app with Vite on the current dev port and verify:
  - `/cameras` renders in the dark shell.
  - Sidebar/topbar match the Stitch layout at desktop width.
  - Camera table renders API data and empty state correctly.
  - Add Camera opens the dark dialog.
  - Edit Camera opens the dark dialog with existing values.
  - Switching MAIN/SUB/EXT changes the active stream panel without elongating the dialog.
  - Save and cancel flows still work.
- Use browser/manual verification if Chromium dependencies are available; otherwise report the limitation explicitly.

## Implementation notes

- Prefer incremental changes over a big-bang rewrite.
- Create focused shell/theme components instead of duplicating large layout blocks inside `/cameras`.
- Keep non-Cameras pages functional even if their inner content still uses older styling.
- Avoid adding backend fields solely to support placeholder stats in this pass.
