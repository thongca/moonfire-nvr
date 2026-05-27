# Add Camera Command Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the camera add/edit dialog into a Stitch-matched Command Center dialog with stream summary cards synchronized to MAIN/SUB/EXT tabs.

**Architecture:** Keep the work localized to `ui/src/Cameras/AddEditDialog.tsx` and its tests. Add small local helper functions/components for stream labels, summaries, and section chrome; preserve existing state shape and save calls. Use Material UI components and the existing `shellTokens` theme primitives while matching Stitch project `17174465272393731395`, screen `56506ca7f2fa4b89b49a062518a622e7` (`Add Camera - Moonfire NVR`): dark elevated modal surfaces, Fire Orange active/focus states, compact outlines, and dense form spacing.

**Tech Stack:** React 19, TypeScript, Material UI v7, React Router-independent dialog UI, Vitest, Testing Library, MSW.

---

## File Structure

- Modify `ui/src/Cameras/AddEditDialog.tsx`: add sectioned dialog layout, stream summary cards, synchronized card/tab state, helper text, and dark Command Center styling.
- Modify `ui/src/Cameras/AddEditDialog.test.tsx`: add tests for section headings, stream summary card behavior, summary updates, and preserve the existing save behavior test.
- No new production files are required; keep helper components local because this UI is specific to the camera add/edit dialog.

---

### Task 1: Add tests for section headings and stream summary cards

**Files:**
- Modify: `ui/src/Cameras/AddEditDialog.test.tsx`

- [ ] **Step 1: Update test imports**

Change the first import from Testing Library to include `within`:

```tsx
import { screen, waitFor, within } from "@testing-library/react";
```

- [ ] **Step 2: Add a helper render function after server hooks**

Insert this helper after `afterAll(() => server.close());`:

```tsx
const renderAddDialog = () =>
  renderWithCtx(
    <AddEditDialog
      open={true}
      camera={null}
      csrf="csrf-token"
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
```

- [ ] **Step 3: Add the failing section/summary render test**

Insert this test before the existing save test:

```tsx
test("renders sectioned command dialog stream summaries", () => {
  renderAddDialog();

  expect(screen.getByText("Configure identity, connection, and stream routing"))
    .toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Camera Identity" }))
    .toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Connection" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Stream Routing" }))
    .toBeInTheDocument();

  for (const streamName of ["MAIN", "SUB", "EXT"]) {
    const card = screen.getByTestId(`stream-summary-${streamName.toLowerCase()}`);
    expect(within(card).getByText(streamName)).toBeInTheDocument();
    expect(within(card).getByText("Off")).toBeInTheDocument();
    expect(within(card).getByText("No RTSP URL")).toBeInTheDocument();
    expect(within(card).getByText("Auto")).toBeInTheDocument();
  }
});
```

- [ ] **Step 4: Run the new test and verify it fails**

Run:

```bash
npm --prefix ui test -- Cameras/AddEditDialog.test.tsx --run
```

Expected: FAIL because the subtitle, section headings, and `stream-summary-*` test ids do not exist yet.

- [ ] **Step 5: Commit the failing tests if commits are approved**

Only commit if the user has approved committing during execution:

```bash
git add ui/src/Cameras/AddEditDialog.test.tsx
git commit -m "test: specify add camera command dialog summaries"
```

---

### Task 2: Implement sectioned dialog and stream summary cards

**Files:**
- Modify: `ui/src/Cameras/AddEditDialog.tsx`

- [ ] **Step 1: Add required Material UI imports**

Update imports near the top of `AddEditDialog.tsx` so these components are available:

```tsx
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { shellTokens } from "../theme";
```

Keep all existing imports that are still used.

- [ ] **Step 2: Add local stream summary helpers after `defaultStreamForm`**

Insert these helpers after the existing `defaultStreamForm` function:

```tsx
const streamLabel = (type_: StreamTypeStr) => type_.toUpperCase();

const modeLabel = (mode: string) => (mode === "record" ? "Record" : "Off");

const transportLabel = (transport: string) => {
  if (transport === "tcp") return "TCP";
  if (transport === "udp") return "UDP";
  return "Auto";
};

function DialogSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="overline" component="h3" color="text.secondary">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

function StreamSummaryCard({
  type_,
  stream,
  selected,
  onSelect,
}: {
  type_: StreamTypeStr;
  stream: StreamForm;
  selected: boolean;
  onSelect: () => void;
}) {
  const hasRtsp = stream.rtspUrl.trim().length > 0;

  return (
    <Paper
      component="button"
      type="button"
      data-testid={`stream-summary-${type_}`}
      onClick={onSelect}
      sx={{
        appearance: "none",
        background: selected
          ? `linear-gradient(180deg, rgba(255, 87, 34, 0.16), ${shellTokens.surface.raised})`
          : shellTokens.surface.raised,
        border: `1px solid ${
          selected ? shellTokens.primary.fireOrange : shellTokens.border.subtle
        }`,
        borderRadius: 1,
        color: "text.primary",
        cursor: "pointer",
        p: 1.5,
        textAlign: "left",
        width: "100%",
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography
            variant="overline"
            sx={{ color: selected ? shellTokens.primary.fireOrange : "text.secondary" }}
          >
            {streamLabel(type_)}
          </Typography>
          <Chip
            size="small"
            label={modeLabel(stream.mode)}
            color={stream.mode === "record" ? "primary" : "default"}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {hasRtsp ? "RTSP configured" : "No RTSP URL"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {transportLabel(stream.rtspTransport)}
        </Typography>
      </Stack>
    </Paper>
  );
}
```

- [ ] **Step 3: Replace the dialog JSX with the sectioned layout**

Replace the `return (` block from `<Dialog open={open}...` through `</Dialog>` with this structure:

```tsx
return (
  <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitle sx={{ pb: 1 }}>
      <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
        {isEdit ? `Edit Camera — ${camera!.shortName}` : "Add Camera"}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Configure identity, connection, and stream routing
      </Typography>
    </DialogTitle>
    <DialogContent
      sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 1 }}
    >
      <DialogSection title="Camera Identity">
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField
              label="Short Name"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              required
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              size="small"
              fullWidth
            />
          </Grid>
        </Grid>
      </DialogSection>

      <Divider />

      <DialogSection title="Connection">
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="ONVIF Base URL"
              value={onvifBaseUrl}
              onChange={(e) => setOnvifBaseUrl(e.target.value)}
              placeholder="http://192.168.1.10"
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? "(leave blank to keep)" : ""}
              size="small"
              fullWidth
            />
          </Grid>
        </Grid>
      </DialogSection>

      <Divider />

      <DialogSection title="Stream Routing">
        <Grid container spacing={1.5}>
          {STREAM_TYPES.map((t) => (
            <Grid key={t} size={{ xs: 12, sm: 4 }}>
              <StreamSummaryCard
                type_={t}
                stream={streams[t]}
                selected={activeStream === t}
                onSelect={() => setActiveStream(t)}
              />
            </Grid>
          ))}
        </Grid>

        <Box>
          <Tabs
            value={activeStream}
            onChange={(_, v: StreamTypeStr) => setActiveStream(v)}
            variant="fullWidth"
            sx={{
              borderBottom: `1px solid ${shellTokens.border.subtle}`,
              minHeight: 40,
              "& .MuiTab-root": { minHeight: 40 },
            }}
          >
            {STREAM_TYPES.map((t) => (
              <Tab key={t} label={streamLabel(t)} value={t} />
            ))}
          </Tabs>
          {STREAM_TYPES.map((t) => (
            <Box
              key={t}
              role="tabpanel"
              hidden={activeStream !== t}
              sx={{ pt: 2, display: activeStream === t ? "block" : "none" }}
            >
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Mode</InputLabel>
                    <Select
                      value={streams[t].mode}
                      label="Mode"
                      onChange={(e) => updateStream(t, "mode", e.target.value)}
                    >
                      <MenuItem value="">Off</MenuItem>
                      <MenuItem value="record">Record</MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary">
                    Record enables this stream for capture.
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <TextField
                    label="RTSP URL"
                    value={streams[t].rtspUrl}
                    onChange={(e) => updateStream(t, "rtspUrl", e.target.value)}
                    placeholder="rtsp://192.168.1.10/stream1"
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Transport</InputLabel>
                    <Select
                      value={streams[t].rtspTransport}
                      label="Transport"
                      onChange={(e) =>
                        updateStream(t, "rtspTransport", e.target.value)
                      }
                    >
                      <MenuItem value="">Auto</MenuItem>
                      <MenuItem value="tcp">TCP</MenuItem>
                      <MenuItem value="udp">UDP</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Sample File Dir ID"
                    value={streams[t].sampleFileDirId}
                    onChange={(e) =>
                      updateStream(t, "sampleFileDirId", e.target.value)
                    }
                    helperText="Blank uses the server default."
                    size="small"
                    type="number"
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Box>
          ))}
        </Box>
      </DialogSection>
    </DialogContent>
    <DialogActions
      sx={{
        borderTop: `1px solid ${shellTokens.border.subtle}`,
        position: "sticky",
        bottom: 0,
        background: shellTokens.surface.panel,
      }}
    >
      <Button onClick={onClose} disabled={saving}>
        Cancel
      </Button>
      <Button onClick={handleSave} variant="contained" disabled={saving}>
        {saving ? "Saving…" : "Save Changes"}
      </Button>
    </DialogActions>
  </Dialog>
);
```

- [ ] **Step 4: Run the AddEditDialog tests**

Run:

```bash
npm --prefix ui test -- Cameras/AddEditDialog.test.tsx --run
```

Expected: PASS for the new section/summary test and the existing save test.

- [ ] **Step 5: Commit implementation if commits are approved**

Only commit if the user has approved committing during execution:

```bash
git add ui/src/Cameras/AddEditDialog.tsx ui/src/Cameras/AddEditDialog.test.tsx
git commit -m "feat: add camera command dialog summaries"
```

---

### Task 3: Add interaction tests for card/tab synchronization and live summary updates

**Files:**
- Modify: `ui/src/Cameras/AddEditDialog.test.tsx`

- [ ] **Step 1: Add a test for summary-card tab switching**

Insert this test after `renders sectioned command dialog stream summaries`:

```tsx
test("switches stream form when a summary card is selected", async () => {
  const user = userEvent.setup();
  renderAddDialog();

  await user.click(screen.getByTestId("stream-summary-sub"));

  expect(screen.getByRole("tab", { name: "SUB", selected: true }))
    .toBeInTheDocument();
  await user.type(screen.getByLabelText("RTSP URL"), "rtsp://camera/sub");
  expect(within(screen.getByTestId("stream-summary-sub")).getByText("RTSP configured"))
    .toBeInTheDocument();
  expect(within(screen.getByTestId("stream-summary-main")).getByText("No RTSP URL"))
    .toBeInTheDocument();
});
```

- [ ] **Step 2: Add a test for mode and transport summary updates**

Insert this test after the tab switching test:

```tsx
test("updates the active stream summary from form edits", async () => {
  const user = userEvent.setup();
  renderAddDialog();

  const mainSummary = screen.getByTestId("stream-summary-main");
  expect(within(mainSummary).getByText("Off")).toBeInTheDocument();
  expect(within(mainSummary).getByText("Auto")).toBeInTheDocument();

  await user.click(screen.getByLabelText("Mode"));
  await user.click(screen.getByRole("option", { name: "Record" }));
  expect(within(mainSummary).getByText("Record")).toBeInTheDocument();

  await user.click(screen.getByLabelText("Transport"));
  await user.click(screen.getByRole("option", { name: "TCP" }));
  expect(within(mainSummary).getByText("TCP")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the interaction tests**

Run:

```bash
npm --prefix ui test -- Cameras/AddEditDialog.test.tsx --run
```

Expected: PASS. If Testing Library reports duplicate labels for fields in hidden panels, keep the Task 2 `display: activeStream === t ? "block" : "none"` panel style and query visible controls by exact label text as shown.

- [ ] **Step 4: Commit tests if commits are approved**

Only commit if the user has approved committing during execution:

```bash
git add ui/src/Cameras/AddEditDialog.test.tsx
git commit -m "test: cover camera stream summary interactions"
```

---

### Task 4: Verify full UI quality gate

**Files:**
- No file changes expected unless verification exposes a bug.

- [ ] **Step 1: Run focused camera dialog tests**

Run:

```bash
npm --prefix ui test -- Cameras/AddEditDialog.test.tsx --run
```

Expected: PASS.

- [ ] **Step 2: Run the Dashboard tests because the branch also has Dashboard changes**

Run:

```bash
npm --prefix ui test -- Dashboard.test.tsx --run
```

Expected: PASS.

- [ ] **Step 3: Run all UI tests**

Run:

```bash
npm --prefix ui test -- --run
```

Expected: PASS.

- [ ] **Step 4: Run UI build**

Run:

```bash
npm --prefix ui run build
```

Expected: PASS with Vite production build output and no TypeScript errors.

- [ ] **Step 5: Check git status**

Run:

```bash
git status --short
```

Expected: Only intentional files for this branch are modified/untracked. Do not revert unrelated user changes.
