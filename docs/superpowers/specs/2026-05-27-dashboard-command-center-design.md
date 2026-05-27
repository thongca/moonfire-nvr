# Dashboard Command Center Design

## Goal

Redesign the Moonfire NVR Dashboard into a high-density monitoring and management command center, following the Stitch project `17174465272393731395`, especially screen `35f4949b2bbe490f9144a3c72d7c0326` titled “Dashboard (Monitor & Manage) - Moonfire NVR”.

The design should restore the monitor/report feel from the Stitch reference while keeping data honest: every number comes from the current Moonfire API, or the UI clearly labels the section as unavailable instead of showing fake telemetry.

## Visual direction

Use the Stitch design system as the primary visual reference:

- Dark utilitarian surveillance UI.
- Fire Orange `#ff5722` for active states, recording indicators, and primary actions.
- Inter for general UI text.
- JetBrains Mono styling for timestamps, labels, metrics, and technical status text where practical.
- Compact 4px-ish radii, subtle outlines instead of heavy shadows, and high-density spacing.
- Desktop-first Command Center layout with graceful stacking on smaller screens.

## Layout

The Dashboard content inside the existing application shell should render:

1. Header row
   - Title: `System Overview`.
   - Subtitle: `Infrastructure monitoring and recording telemetry` or equivalent.
   - Right-side `Live Sync` timestamp using the current time formatted for `toplevel.timeZoneName`.

2. KPI row
   - Cameras.
   - Recording Load.
   - Storage Used.
   - Activity Status.

3. Main content grid
   - Left/main column: `Priority Feeds`.
   - Right column: `Quick Management` camera health list.
   - Bottom/main report: `24h Activity Report`.

The layout should resemble Stitch option A / Command Center: top metric cards, large feed area, right management rail, bottom report panel.

## Data mapping

### Cameras KPI

Use `toplevel.cameras.length` for the total camera count.

Compute streams by flattening each camera’s stream values and filtering undefined streams. Count active recording streams with `stream.record === true`.

Show missing or inactive recording state based on cameras without active recording streams.

### Recording Load

Do not display CPU or RAM percentages unless the backend exposes those values.

Instead, show recording load as the ratio of active recording streams to total streams. If there are no streams, show an empty state such as `0 streams active`.

### Storage Used

Use stream totals:

- `stream.fsBytes` for storage on disk.
- `stream.totalSampleFileBytes` for recorded sample bytes.

Use labels such as `Storage Used` and `Recorded Samples`, not `Free TB`, because the current top-level API does not expose free disk capacity.

### Activity Status

Use available API state:

- `toplevel.signals`.
- `toplevel.permissions`.
- Derived camera and stream status.

If there are no signals, show `No active signals` rather than synthetic alerts.

### Priority Feeds

Render one card per camera.

Each card should prioritize the most recent available recording/video if the current API exposes enough information to link or preview it. If the API cannot provide a recent recording for that camera, keep the card visible and show `No recent recording` with actions such as `Open Archive` or `Manage Camera`.

Do not use unlabeled demo imagery. If future demo data is ever introduced, it must be visibly labeled as demo data, but this design does not require demo data.

### Quick Management

Render all cameras in a right-side management list.

Each item should show:

- Camera name.
- Stream count.
- Recording status derived from active recording streams.
- A management action linking to the camera/config area, and optionally archive when useful.

### 24h Activity Report

Prefer real recording/storage time-series data if the existing API already exposes it.

If no usable 24-hour time-series data exists, keep the report panel but show a clear placeholder: `Recording activity history not available yet`. Do not draw fake bandwidth bars or fake Mbps labels.

## Component structure

Start by keeping the redesign in `ui/src/Dashboard.tsx` with small local components. Split into separate files only if the file becomes difficult to read.

Suggested local components:

- `DashboardActivity`: top-level activity component receiving `toplevel` and `Frame`.
- `MetricCard`: reusable KPI card.
- `PriorityFeeds`: feed grid container.
- `CameraFeedCard`: one camera’s recent recording card or `No recent recording` state.
- `QuickManagement`: right-side camera health list.
- `ActivityReport`: bottom report panel.

Suggested helper functions:

- `formatCount`.
- `formatBytes`.
- `formatDuration` if needed.
- `getDashboardStats`.
- `getCameraHealth`.

## Error and empty states

Empty states are first-class UI, not failures:

- No cameras: show KPI zeros, an empty Priority Feeds section, and a clear path to `Manage Cameras`.
- Camera without recordings: show its feed card with `No recent recording`.
- No time-series report data: show the report panel placeholder.
- API query errors remain handled by the existing app-level `Error querying server` behavior.

## Testing and verification

Update Dashboard tests to cover:

- The Command Center title renders.
- KPI values are derived from supplied `toplevel` test data.
- Cameras with no recent recording render `No recent recording`.
- Quick Management lists cameras.
- The report panel shows the unavailable placeholder when no time-series data exists.

After implementation, run the relevant UI tests and build. Then manually verify in the browser at `http://10.20.0.201:5175/#/` with the local backend running.

## Out of scope

- Adding new backend telemetry APIs.
- Faking CPU, RAM, network Mbps, or free disk telemetry.
- Implementing real video thumbnail extraction if the current API does not already support it.
- Redesigning non-dashboard pages.