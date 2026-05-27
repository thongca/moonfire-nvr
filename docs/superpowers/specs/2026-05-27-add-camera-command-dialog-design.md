# Add Camera Command Dialog Design

## Goal

Redesign the camera add/edit dialog so it feels like part of the Stitch-inspired Moonfire NVR Command Center instead of a long generic form. The dialog should make camera identity, connection credentials, and stream configuration easy to scan while preserving the existing API behavior.

This spec covers `ui/src/Cameras/AddEditDialog.tsx` and the MAIN/SUB/EXT stream tabs. It does not redesign the entire Cameras page.

## Visual direction

Match the dashboard command-center direction:

- Dark utilitarian surveillance UI.
- Fire Orange `#ff5722` for the active stream, primary action, and selected tab/card accent.
- Compact radii, subtle borders, dense spacing, and low-shadow surfaces.
- Technical labels can use the existing app typography; stream labels and status text should feel compact and operational.
- Desktop dialog should be wider than the current form if needed, while remaining usable on mobile.

## Dialog structure

Use a sectioned single-dialog flow rather than a multi-step wizard.

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
