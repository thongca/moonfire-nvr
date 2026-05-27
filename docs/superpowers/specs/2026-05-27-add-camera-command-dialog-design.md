# Add Camera Command Dialog Design

## Goal

Redesign the camera add/edit dialog so it follows the actual Stitch reference instead of a long generic form. The primary source is Stitch project `17174465272393731395`, screen `56506ca7f2fa4b89b49a062518a622e7` titled `Add Camera - Moonfire NVR`, plus the project's Moonfire NVR design system. The dialog should make camera identity, connection credentials, and stream configuration easy to scan while preserving the existing API behavior.

This spec covers `ui/src/Cameras/AddEditDialog.tsx` and the MAIN/SUB/EXT stream tabs. It does not redesign the entire Cameras page.

## Visual direction

Match the Stitch `Add Camera - Moonfire NVR` screen and project design system:

- Dark utilitarian surveillance UI using surface layers from the Stitch design system: base `#131313`, low/container surfaces around `#1c1b1b` / `#201f1f`, and elevated modal surfaces around `#353534`.
- Fire Orange `#ff5722` for the active stream, primary action, selected tab/card accent, and focus emphasis.
- Inter for form text and headings; JetBrains Mono-style treatment for compact stream labels/status metadata where practical.
- 4px-ish radii, subtle 1px outlines instead of heavy shadows, dense 4px/8px/12px spacing, and low-glare controls.
- Inputs should resemble the Stitch screen: dark filled fields, rounded compact corners, visible outline, and orange focus/active states.
- Desktop dialog should be wider than the current form if needed, while remaining usable on mobile.

## Dialog structure

Use a sectioned single-dialog flow rather than a multi-step wizard. Preserve the Stitch Add Camera modal feel: dense dark form, strong title, clear bottom actions, and MAIN/SUB/EXT stream navigation using orange active state.

### Header

- Title remains `Add Camera` or `Edit Camera — <name>`.
- Add a short subtitle or helper text such as `Configure identity, connection, and stream routing`.
- Keep close behavior unchanged.

### Camera Identity section

Group these fields together under a clear section heading:

- `Short Name *`
- `Description`

The short name remains required and validation behavior remains unchanged.

### Connection section

Group these fields together under a clear section heading:

- `ONVIF Base URL`
- `Username`
- `Password`

For edit mode, keep the existing password behavior: blank password keeps the current value, and username can remain `(unchanged)`.

### Stream Routing section

Replace the visually flat stream area with summary cards plus tabs.

#### Stream summary cards

Render three compact cards for `MAIN`, `SUB`, and `EXT` above the tabs.

Each card should show:

- Stream type label.
- Current mode summary: `Record` or `Off`.
- RTSP state: `RTSP configured` or `No RTSP URL`.
- Transport: `Auto`, `TCP`, or `UDP`.

Card behavior:

- Clicking a card sets the active stream tab.
- The active card uses Fire Orange border/accent.
- Inactive cards use subtle borders.
- Cards must derive all text from the current local form state, so edits update the summary immediately.

#### Stream tabs

Keep MAIN/SUB/EXT tabs for detailed editing.

- Active tab uses Fire Orange underline and text.
- Tabs remain keyboard accessible through MUI Tabs.
- Only the active stream form is visible.
- The tabs and summary cards must stay synchronized.

#### Active stream form

For the selected stream, show:

- `Mode`
- `RTSP URL`
- `Transport`
- `Sample File Dir ID`

Add concise helper text where useful:

- `Mode`: indicates whether this stream records.
- `RTSP URL`: use the existing RTSP placeholder.
- `Sample File Dir ID`: identify that blank uses backend/default behavior if that is the current behavior.

Do not change request payload semantics.

## Actions

Keep the existing actions and behavior:

- `Cancel`
- `Save Changes`
- Disabled save while saving.
- Existing create/update stream save sequence.

Visual updates:

- Footer should remain easy to reach in long dialogs. Prefer sticky dialog actions if it does not conflict with MUI layout or tests.
- Primary save button uses Fire Orange contained styling through the theme.
- Cancel remains secondary/low-emphasis.

## Responsive behavior

- Desktop: identity and connection sections can use compact two-column layouts where practical.
- Stream summary cards render as three columns on desktop.
- Mobile/small dialogs: summary cards stack or wrap, fields become single-column, and the active tab form remains readable.

## Data and behavior constraints

- Preserve current local state shape: `shortName`, `description`, `onvifBaseUrl`, `username`, `password`, `activeStream`, and `streams`.
- Preserve current create/edit API calls:
  - `api.createCamera`
  - `api.updateCamera`
  - `api.updateCameraStream`
- Preserve current stream types: `main`, `sub`, `ext`.
- Do not add ONVIF discovery, stream probing, or backend telemetry.
- Do not fake stream health or validation beyond the local form state.

## Tests

Update `ui/src/Cameras/AddEditDialog.test.tsx` to cover:

- Add dialog renders section headings: Camera Identity, Connection, Stream Routing.
- Stream summary cards render MAIN/SUB/EXT and reflect mode/RTSP/transport state.
- Clicking a stream summary card switches the active tab/form.
- Editing the active stream updates the matching summary card.
- Existing save behavior still sends camera and stream payloads correctly.

## Out of scope

- Full Cameras page redesign.
- Wizard flow.
- Backend changes.
- ONVIF auto-discovery or RTSP validation.
- Real stream preview in the add/edit dialog.
