# Stitch App Shell and Camera Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared dark Stitch-inspired app shell and migrate the Cameras experience to it, including a pixel-close Cameras page and dark add/edit dialog, while keeping existing routes functional.

**Architecture:** Introduce a reusable shell layer around the existing route content instead of rewriting every page at once. Add a focused dark theme/token foundation, migrate `/cameras` as the golden reference page, and restyle the existing camera dialog so behavior stays the same while layout and visuals move toward the approved Stitch design.

**Tech Stack:** React, TypeScript, MUI, React Router, Vitest, Vite

---

## File map

### Existing files to modify

- `ui/src/index.tsx` — replace the current mostly-default theme with the approved dark token/theme baseline.
- `ui/src/App.tsx` — keep login/toplevel fetching, but change the Frame wrapper to use the new shell.
- `ui/src/Cameras/index.tsx` — replace the simple table layout with the Stitch-style page.
- `ui/src/Cameras/AddEditDialog.tsx` — restyle and restructure the camera dialog to only show the active stream panel.
- `ui/src/App.test.tsx` — update routing/shell tests and add regression coverage for shell rendering if needed.

### New files to create

- `ui/src/theme.ts` — central dark Stitch-inspired MUI theme and reusable color/spacing tokens.
- `ui/src/components/AppShell.tsx` — reusable sidebar/topbar/content shell.
- `ui/src/components/AppShell.test.tsx` — shell rendering and nav-state tests.
- `ui/src/Cameras/CamerasPage.test.tsx` — camera page rendering tests for stats/table/empty state.
- `ui/src/Cameras/AddEditDialog.test.tsx` — dialog behavior tests, especially active tab rendering.
- `ui/src/Cameras/viewModel.ts` — focused helper functions to derive display-only values (IP chip, badges, status label, storage label).
- `ui/src/Cameras/viewModel.test.ts` — tests for the camera page display derivations.

### Existing files to inspect while implementing

- `ui/src/api.ts` — camera admin types and existing CRUD calls.
- `ui/src/snackbars.tsx` — existing error/success messaging.
- `ui/src/List/index.tsx` — route content that must continue to render inside the new shell.
- `ui/src/Live/index.tsx` — route content that must continue to render inside the new shell.
- `docs/superpowers/specs/2026-05-26-stitch-app-shell-camera-management-design.md` — approved spec.

---

### Task 1: Add the shared dark theme foundation

**Files:**
- Create: `ui/src/theme.ts`
- Modify: `ui/src/index.tsx:5-60`
- Test: `ui/src/App.test.tsx`

- [ ] **Step 1: Write the failing theme smoke test**

Add a test in `ui/src/App.test.tsx` that proves the app renders with a predictable shell-compatible dark background token rather than the existing default light theme assumptions.

```tsx
it("renders inside the dark theme baseline", async () => {
  render(<App />);
  expect(document.body).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify the current app baseline**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm test -- App.test.tsx --runInBand
```

Expected: the existing test suite passes, confirming a stable baseline before the theme refactor.

- [ ] **Step 3: Create the dark Stitch theme file**

Create `ui/src/theme.ts` with a single exported theme and explicit tokens.

```ts
import { createTheme } from "@mui/material/styles";

export const shellTokens = {
  background: "#131313",
  surfaceLow: "#1c1b1b",
  surface: "#201f1f",
  surfaceHigh: "#2a2a2a",
  surfaceHighest: "#353534",
  outline: "#5b4039",
  outlineStrong: "#ab8980",
  primary: "#ff5722",
  primarySoft: "#ffb5a0",
  textPrimary: "#e5e2e1",
  textSecondary: "#c8c6c6",
  textMuted: "#b6b5b4",
  success: "#35d07f",
  danger: "#ff5c5c",
  info: "#86cfff",
};

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: shellTokens.primary },
    secondary: { main: shellTokens.primarySoft },
    background: {
      default: shellTokens.background,
      paper: shellTokens.surface,
    },
    text: {
      primary: shellTokens.textPrimary,
      secondary: shellTokens.textSecondary,
    },
    divider: shellTokens.outline,
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: 'Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: shellTokens.background,
          color: shellTokens.textPrimary,
        },
      },
    },
  },
});

export default theme;
```

- [ ] **Step 4: Switch the app entry point to the shared theme**

Update `ui/src/index.tsx` to import the new theme and remove the inline temporary theme.

```tsx
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "./theme";

root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <SnackbarProvider autoHideDuration={5000}>
            <HashRouter>
              <App />
            </HashRouter>
          </SnackbarProvider>
        </LocalizationProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 5: Run the app test and build checks**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm test -- App.test.tsx --runInBand && npm run build
```

Expected: tests pass and the UI still builds.

- [ ] **Step 6: Commit the theme foundation**

```bash
git add ui/src/theme.ts ui/src/index.tsx ui/src/App.test.tsx
git commit -m "feat(ui): add stitch-inspired dark theme foundation"
```

### Task 2: Build the shared app shell

**Files:**
- Create: `ui/src/components/AppShell.tsx`
- Create: `ui/src/components/AppShell.test.tsx`
- Modify: `ui/src/App.tsx:41-197`
- Test: `ui/src/components/AppShell.test.tsx`

- [ ] **Step 1: Write the failing shell rendering test**

Create `ui/src/components/AppShell.test.tsx`.

```tsx
import { render, screen } from "@testing-library/react";
import AppShell from "./AppShell";

it("renders topbar, sidebar, and content", () => {
  render(
    <AppShell currentPath="/cameras" onLogout={async () => {}}>
      <div>page body</div>
    </AppShell>,
  );
  expect(screen.getByText("Moonfire NVR")).toBeInTheDocument();
  expect(screen.getByText("Dashboard")).toBeInTheDocument();
  expect(screen.getByText("Cameras")).toBeInTheDocument();
  expect(screen.getByText("page body")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the shell test to verify it fails**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm test -- src/components/AppShell.test.tsx --runInBand
```

Expected: FAIL because `AppShell.tsx` does not exist yet.

- [ ] **Step 3: Implement the reusable shell**

Create `ui/src/components/AppShell.tsx`.

```tsx
import SearchIcon from "@mui/icons-material/Search";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router";
import { shellTokens } from "../theme";

interface Props {
  currentPath: string;
  children: React.ReactNode;
  onLogout: () => Promise<void>;
}

const navItems = [
  { label: "Dashboard", to: "/", icon: <DashboardOutlinedIcon /> },
  { label: "Live View", to: "/live", icon: <VideocamOutlinedIcon /> },
  { label: "Archive", to: "/archive", icon: <HistoryOutlinedIcon /> },
  { label: "Settings", to: "/settings", icon: <TuneOutlinedIcon /> },
  { label: "Cameras", to: "/cameras", icon: <CameraAltOutlinedIcon /> },
];

export default function AppShell({ currentPath, children, onLogout }: Props) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: shellTokens.background, color: shellTokens.textPrimary }}>
      <Box sx={{ height: 80, borderBottom: `1px solid ${shellTokens.outline}`, display: "flex", alignItems: "center", px: 3, gap: 3 }}>
        <Typography variant="h3" sx={{ fontSize: 34, color: shellTokens.primarySoft }}>
          Moonfire NVR
        </Typography>
        <Box sx={{ width: 320, display: "flex", alignItems: "center", gap: 1, px: 2, py: 1, border: `1px solid ${shellTokens.outline}`, borderRadius: 1, bgcolor: shellTokens.surfaceLow }}>
          <SearchIcon fontSize="small" />
          <InputBase placeholder="Search cameras..." sx={{ flex: 1 }} />
        </Box>
        <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
          <IconButton color="inherit"><NotificationsNoneOutlinedIcon /></IconButton>
          <IconButton color="inherit"><SettingsOutlinedIcon /></IconButton>
          <IconButton color="inherit"><AccountCircleOutlinedIcon /></IconButton>
        </Box>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: "calc(100vh - 80px)" }}>
        <Box sx={{ borderRight: `1px solid ${shellTokens.outline}`, bgcolor: shellTokens.surfaceLow, display: "flex", flexDirection: "column" }}>
          <Stack spacing={3} sx={{ p: 3, flex: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ width: 48, height: 48, borderRadius: 0.5, bgcolor: shellTokens.primary }} />
              <Box>
                <Typography variant="h6">Moonfire NVR</Typography>
                <Typography variant="body2" color="text.secondary">Active</Typography>
              </Box>
            </Stack>
            <List disablePadding>
              {navItems.map((item) => {
                const active = currentPath === item.to;
                return (
                  <ListItemButton
                    key={item.to}
                    component={RouterLink}
                    to={item.to}
                    selected={active}
                    sx={{
                      mb: 1,
                      borderRadius: 1,
                      bgcolor: active ? shellTokens.primary : "transparent",
                      color: active ? "#fff" : shellTokens.textPrimary,
                      '&:hover': { bgcolor: active ? shellTokens.primary : shellTokens.surfaceHigh },
                    }}
                  >
                    <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                );
              })}
            </List>
            <Button variant="contained" sx={{ mt: "auto", bgcolor: shellTokens.primary }}>Export Clip</Button>
          </Stack>
          <Stack spacing={2} sx={{ p: 3, borderTop: `1px solid ${shellTokens.outline}` }}>
            <Typography variant="body2">Support</Typography>
            <Button onClick={() => void onLogout()} sx={{ justifyContent: "flex-start", color: shellTokens.textPrimary }}>Log Out</Button>
          </Stack>
        </Box>
        <Box sx={{ px: 4, py: 4 }}>{children}</Box>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Wire the shell into `App.tsx`**

Wrap route content with the shared shell from the Frame layer.

```tsx
import { useLocation } from "react-router";
import AppShell from "./components/AppShell";

const location = useLocation();

const Frame = ({ activityMenuPart, children }: FrameProps): React.JSX.Element => {
  return (
    <>
      <Login ... />
      {toplevel?.user !== undefined && <ChangePassword ... />}
      {error !== null ? (
        <AppShell currentPath={location.pathname} onLogout={logout}>
          <Container>
            <h2>Error querying server</h2>
            <pre>{error.message}</pre>
          </Container>
        </AppShell>
      ) : (
        <AppShell currentPath={location.pathname} onLogout={logout}>
          {children}
        </AppShell>
      )}
    </>
  );
};
```

Keep the login/toplevel behavior. Remove the old `Header` wrapper from the Frame.

- [ ] **Step 5: Run the shell test and app tests**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm test -- src/components/AppShell.test.tsx src/App.test.tsx --runInBand
```

Expected: both tests pass and routes still render inside the shell.

- [ ] **Step 6: Commit the shell**

```bash
git add ui/src/components/AppShell.tsx ui/src/components/AppShell.test.tsx ui/src/App.tsx
git commit -m "feat(ui): add shared stitch-style app shell"
```

### Task 3: Add camera-page display helpers

**Files:**
- Create: `ui/src/Cameras/viewModel.ts`
- Create: `ui/src/Cameras/viewModel.test.ts`
- Test: `ui/src/Cameras/viewModel.test.ts`

- [ ] **Step 1: Write failing view-model tests**

Create `ui/src/Cameras/viewModel.test.ts`.

```ts
import { describe, expect, it } from "vitest";
import { cameraIp, cameraStatus, storageLabel, streamBadgeLabel } from "./viewModel";

describe("camera view model", () => {
  it("derives IP from onvif URL when available", () => {
    expect(cameraIp({ onvifBaseUrl: "http://192.168.1.10", streams: [] } as any)).toBe("192.168.1.10");
  });

  it("falls back to rtsp host", () => {
    expect(
      cameraIp({
        streams: [{ rtspUrl: "rtsp://192.168.1.11/stream1", mode: "record", type_: "main" }],
      } as any),
    ).toBe("192.168.1.11");
  });

  it("marks record streams as online", () => {
    expect(cameraStatus({ streams: [{ mode: "record" }] } as any).label).toBe("Online");
  });

  it("creates record badge label", () => {
    expect(streamBadgeLabel({ type_: "main", mode: "record" } as any)).toBe("MAIN REC");
  });

  it("formats storage dir fallback", () => {
    expect(storageLabel({ streams: [{ sampleFileDirId: 7 }] } as any)).toBe("Dir #7");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm test -- src/Cameras/viewModel.test.ts --runInBand
```

Expected: FAIL because `viewModel.ts` does not exist yet.

- [ ] **Step 3: Implement the display helpers**

Create `ui/src/Cameras/viewModel.ts`.

```ts
import * as api from "../api";

export function cameraIp(camera: api.CameraAdminEntry): string {
  const urls = [camera.onvifBaseUrl, ...camera.streams.map((s) => s.rtspUrl)];
  for (const raw of urls) {
    if (!raw) continue;
    try {
      return new URL(raw).hostname || "—";
    } catch {
      continue;
    }
  }
  return "—";
}

export function streamBadgeLabel(stream: api.StreamAdminEntry): string {
  return stream.mode === "record"
    ? `${stream.type_.toUpperCase()} REC`
    : `${stream.type_.toUpperCase()} OFF`;
}

export function storageLabel(camera: api.CameraAdminEntry): string {
  const dir = camera.streams.find((s) => s.sampleFileDirId !== undefined)?.sampleFileDirId;
  return dir === undefined ? "—" : `Dir #${dir}`;
}

export function cameraStatus(camera: api.CameraAdminEntry): {
  label: "Online" | "Offline";
  color: "success" | "danger";
} {
  const online = camera.streams.some((s) => s.mode === "record");
  return online
    ? { label: "Online", color: "success" }
    : { label: "Offline", color: "danger" };
}
```

- [ ] **Step 4: Run the view-model tests**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm test -- src/Cameras/viewModel.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit the camera display helpers**

```bash
git add ui/src/Cameras/viewModel.ts ui/src/Cameras/viewModel.test.ts
git commit -m "feat(ui): add camera management display helpers"
```

### Task 4: Rebuild the Cameras page to match the Stitch screen

**Files:**
- Modify: `ui/src/Cameras/index.tsx:1-169`
- Create: `ui/src/Cameras/CamerasPage.test.tsx`
- Modify: `ui/src/api.ts:500-512` (only if a small local type helper is needed)
- Test: `ui/src/Cameras/CamerasPage.test.tsx`

- [ ] **Step 1: Write the failing Cameras page tests**

Create `ui/src/Cameras/CamerasPage.test.tsx`.

```tsx
import { render, screen } from "@testing-library/react";
import CamerasActivity from "./index";

it("renders the camera management heading and add button", () => {
  const Frame = ({ children }: any) => <>{children}</>;
  render(<CamerasActivity Frame={Frame} csrf="csrf" />);
  expect(screen.getByText("Camera Management")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /add camera/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify the current page baseline**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm test -- src/Cameras/CamerasPage.test.tsx --runInBand
```

Expected: the current page may partially pass, but it will not verify the new stats cards, table columns, and dark row content you are about to add.

- [ ] **Step 3: Replace the Cameras page structure with the Stitch layout**

Refactor `ui/src/Cameras/index.tsx` to render:

- page heading + subtitle + Add Camera button
- four stats cards
- dark table header
- rows using `cameraIp`, `cameraStatus`, `storageLabel`, `streamBadgeLabel`
- action buttons for edit/delete

Representative page structure:

```tsx
<Typography variant="h3" sx={{ mb: 1 }}>Camera Management</Typography>
<Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
  Configure and manage connected IP cameras
</Typography>
<Grid container spacing={2} sx={{ mb: 4 }}>
  <Grid size={{ xs: 12, md: 3 }}><StatCard label="Total Cameras" value={String(cameras.length).padStart(2, "0")} /></Grid>
  <Grid size={{ xs: 12, md: 3 }}><StatCard label="Storage Status" value="—" /></Grid>
  <Grid size={{ xs: 12, md: 3 }}><StatCard label="System Health" value="—" /></Grid>
  <Grid size={{ xs: 12, md: 3 }}><StatCard label="Alerts (24h)" value="—" /></Grid>
</Grid>
<Box sx={{ border: `1px solid ${shellTokens.outline}`, borderRadius: 1, overflow: "hidden" }}>
  {/* custom header and rows */}
</Box>
```

For empty state, keep a shell-consistent panel saying `No cameras configured.` and still show the page header + stats cards.

- [ ] **Step 4: Run the page test and build**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm test -- src/Cameras/CamerasPage.test.tsx src/Cameras/viewModel.test.ts --runInBand && npm run build
```

Expected: tests pass and build succeeds.

- [ ] **Step 5: Commit the Cameras page redesign**

```bash
git add ui/src/Cameras/index.tsx ui/src/Cameras/CamerasPage.test.tsx ui/src/Cameras/viewModel.ts ui/src/Cameras/viewModel.test.ts
git commit -m "feat(ui): redesign camera management page"
```

### Task 5: Restyle and restructure the add/edit camera dialog

**Files:**
- Modify: `ui/src/Cameras/AddEditDialog.tsx:1-308`
- Create: `ui/src/Cameras/AddEditDialog.test.tsx`
- Test: `ui/src/Cameras/AddEditDialog.test.tsx`

- [ ] **Step 1: Write the failing dialog regression test**

Create `ui/src/Cameras/AddEditDialog.test.tsx`.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddEditDialog from "./AddEditDialog";

it("shows only the active stream panel", async () => {
  render(
    <AddEditDialog
      open
      camera={null}
      csrf="csrf"
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
  expect(screen.getByLabelText("RTSP URL")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "SUB" }));
  expect(screen.getByRole("tab", { name: "SUB", selected: true })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to capture the current dialog behavior**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm test -- src/Cameras/AddEditDialog.test.tsx --runInBand
```

Expected: current tests either fail or do not capture the overlong hidden-panel behavior yet.

- [ ] **Step 3: Refactor the dialog to a sectioned dark modal**

Update `ui/src/Cameras/AddEditDialog.tsx` so that:

- dialog paper is dark and outlined
- password gets a show/hide control
- a `renderStreamPanel(activeStream)` style helper renders only one stream panel
- footer actions are visually distinct and fixed at the bottom of dialog content flow

Representative stream rendering change:

```tsx
const stream = streams[activeStream];

<Box sx={{ border: `1px solid ${shellTokens.outline}`, borderRadius: 1, p: 2, bgcolor: shellTokens.surfaceLow }}>
  <Tabs value={activeStream} onChange={(_, v: StreamTypeStr) => setActiveStream(v)}>
    {STREAM_TYPES.map((t) => (
      <Tab key={t} label={t.toUpperCase()} value={t} />
    ))}
  </Tabs>
  <Box sx={{ mt: 2, display: "grid", gap: 2 }}>
    <FormControl fullWidth size="small">...</FormControl>
    <TextField label="RTSP URL" value={stream.rtspUrl} ... />
    <FormControl fullWidth size="small">...</FormControl>
    <TextField label="Sample File Dir ID" value={stream.sampleFileDirId} ... />
  </Box>
</Box>
```

Representative password toggle:

```tsx
const [showPassword, setShowPassword] = useState(false);

<TextField
  label="Password"
  type={showPassword ? "text" : "password"}
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  slotProps={{
    input: {
      endAdornment: (
        <InputAdornment position="end">
          <IconButton onClick={() => setShowPassword((v) => !v)} edge="end">
            {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
          </IconButton>
        </InputAdornment>
      ),
    },
  }}
/>
```

- [ ] **Step 4: Run dialog tests and a full UI build**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm test -- src/Cameras/AddEditDialog.test.tsx --runInBand && npm run build
```

Expected: dialog tests pass and build succeeds.

- [ ] **Step 5: Commit the dialog redesign**

```bash
git add ui/src/Cameras/AddEditDialog.tsx ui/src/Cameras/AddEditDialog.test.tsx
git commit -m "feat(ui): restyle camera management dialog"
```

### Task 6: Verify shell compatibility across existing routes

**Files:**
- Modify: `ui/src/App.test.tsx`
- Inspect: `ui/src/List/index.tsx`, `ui/src/Live/index.tsx`, `ui/src/Users/index.tsx`
- Test: `ui/src/App.test.tsx`

- [ ] **Step 1: Add route compatibility tests**

Extend `ui/src/App.test.tsx` to confirm existing route content still renders within the shell after the Frame migration.

```tsx
it("renders existing route content inside the shell", async () => {
  render(<App />);
  expect(screen.getByText("Moonfire NVR")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the app route tests**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm test -- App.test.tsx --runInBand
```

Expected: PASS after updating mocks as needed for the new shell.

- [ ] **Step 3: Fix any shell regressions for non-Cameras pages**

Apply only minimal compatibility changes. Keep route page internals intact unless a shell assumption breaks them.

Representative compatibility code if needed:

```tsx
<Box sx={{ minWidth: 0, width: "100%" }}>{children}</Box>
```

Use focused layout guards instead of redesigning Live/List/Users page internals.

- [ ] **Step 4: Run full frontend verification**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm test --runInBand && npm run build && npm run lint
```

Expected: all frontend tests pass, build succeeds, lint succeeds.

- [ ] **Step 5: Commit compatibility fixes**

```bash
git add ui/src/App.test.tsx ui/src/App.tsx ui/src/components/AppShell.tsx
git commit -m "fix(ui): preserve route compatibility in app shell"
```

### Task 7: Manual run verification against the current dev environment

**Files:**
- Inspect only: `ui/src/App.tsx`, `ui/src/Cameras/index.tsx`, `ui/src/Cameras/AddEditDialog.tsx`
- Verify against running app on current dev ports

- [ ] **Step 1: Start the backend and Vite proxy using the current known-good ports**

Run:

```bash
/home/ai/dev/moonfire-nvr/server/target/debug/moonfire-nvr run --config /tmp/moonfire-nvr-dev/config.toml
```

in one shell, then:

```bash
CHOKIDAR_USEPOLLING=1 PROXY_TARGET=http://127.0.0.1:18081/ npm --prefix /home/ai/dev/moonfire-nvr/ui run dev -- --host 0.0.0.0 --port 5175 --strictPort
```

Expected: backend binds `127.0.0.1:18081`; Vite binds `0.0.0.0:5175`.

- [ ] **Step 2: Verify HTTP endpoints before opening the UI**

Run:

```bash
python3 - <<'PY'
import urllib.request
for url in [
  'http://127.0.0.1:18081/api/',
  'http://127.0.0.1:5175/',
  'http://127.0.0.1:5175/api/cameras',
]:
    with urllib.request.urlopen(url, timeout=3) as r:
        print(url, r.status, r.headers.get('content-type'))
PY
```

Expected:

```text
http://127.0.0.1:18081/api/ 200 application/json
http://127.0.0.1:5175/ 200 text/html
http://127.0.0.1:5175/api/cameras 200 application/json
```

- [ ] **Step 3: Manually verify the Cameras page at desktop width**

Open:

```text
http://10.20.0.201:5175/#/cameras
```

Verify all of the following visually:

- topbar and sidebar match the dark Stitch shell
- Cameras nav is the active orange item
- page title/subtitle and Add Camera button match the reference hierarchy
- four stats cards are present
- camera rows use mono-like IP chips and stream badges
- empty placeholders use `—` where real backend metrics do not exist

- [ ] **Step 4: Manually verify the add/edit dialog**

In the running UI:

- click `Add Camera`
- verify the dark dialog styling and footer actions
- switch MAIN / SUB / EXT tabs
- confirm only one stream panel is shown at a time
- open Edit on an existing row and confirm values populate
- click Cancel and verify dialog closes cleanly

Expected: no reappearance of the vertically stacked hidden stream forms from the old layout.

- [ ] **Step 5: Commit after manual verification**

```bash
git add ui/src/theme.ts ui/src/components/AppShell.tsx ui/src/Cameras/index.tsx ui/src/Cameras/AddEditDialog.tsx ui/src/Cameras/viewModel.ts ui/src/*.test.tsx ui/src/Cameras/*.test.ts*
git commit -m "feat(ui): align app shell and cameras with stitch design"
```

---

## Spec coverage check

- Shared dark shell: covered by Tasks 1-2.
- Cameras page as golden reference: covered by Tasks 3-4.
- Dark add/edit dialog with active-stream-only rendering: covered by Task 5.
- Non-Cameras routes remain functional inside shell: covered by Task 6.
- Manual run verification on current dev ports and LAN URL: covered by Task 7.
- Placeholder metrics without fake production data: covered by Task 4 and manual verification in Task 7.

## Placeholder and consistency check

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- File paths are concrete.
- Commands point to the current known working dev setup: backend `127.0.0.1:18081`, UI `0.0.0.0:5175` with `PROXY_TARGET=http://127.0.0.1:18081/`.
- Helper names (`cameraIp`, `cameraStatus`, `storageLabel`, `streamBadgeLabel`) are defined before they are referenced later.
