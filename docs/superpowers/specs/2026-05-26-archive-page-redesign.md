# Archive Page Redesign Spec

## Goal

Redesign the `/archive` route to match the Stitch "Archive Playback" design: 3-column layout with video player, functional timeline scrubber (click/drag seek), recording list panel, and export dialog with real download.

## Approach

Create `ui/src/Archive/` as a new folder with sub-components. Reuse `combine()` and `api.recordings` from the existing `List/` folder. The old `List/` folder is kept intact; `App.tsx` routes `/archive` to the new `ArchiveActivity` instead.

## File Structure

| File | Purpose |
|---|---|
| `ui/src/Archive/index.tsx` | State container, fetch logic, layout shell |
| `ui/src/Archive/TopBar.tsx` | Date picker, time display, camera chips |
| `ui/src/Archive/VideoPlayer.tsx` | `<video>`, overlays, custom playback controls |
| `ui/src/Archive/TimelineScrubber.tsx` | Segment rendering, playhead, click/drag seek, zoom |
| `ui/src/Archive/RecordingList.tsx` | Right panel: recording rows + export CTA |
| `ui/src/Archive/ExportDialog.tsx` | Trim inputs, timestamp track checkbox, download |
| `ui/src/Archive/Archive.test.tsx` | Integration tests for the page |

The `combine()` function and `CombinedRecording` type are imported from `../List/VideoList`.

---

## Section 1: Layout & Data Flow

### Layout

```
[AppShell sidebar 280px] | [Main area flex-1] | [RecordingList panel 300px]
```

Main area (column):
```
[TopBar ~64px]
[VideoPlayer flex-1, 16:9 aspect ratio]
[TimelineScrubber ~120px]
```

### State (in `ArchiveActivity`)

| State | Type | Description |
|---|---|---|
| `selectedCamera` | `Camera \| null` | Camera being viewed; defaults to first camera with recordings |
| `selectedDate` | `Date` | Date being viewed; defaults to today |
| `recordings` | `CombinedRecording[]` | All recordings for selected camera/stream/date |
| `loadingRecordings` | `boolean` | True while fetching |
| `activeRecording` | `CombinedRecording \| null` | Currently playing recording |
| `currentTime90k` | `number \| null` | Playhead position, updated from video `timeupdate` event |
| `exportDialogOpen` | `boolean` | Whether ExportDialog is visible |

### Data Flow

1. `selectedCamera` + `selectedDate` → fetch `api.recordings()` for full day range (00:00→23:59 in server timezone)
2. `recordings` → rendered in `RecordingList` panel + `TimelineScrubber` segments
3. Click recording (panel or timeline) → set `activeRecording` → `VideoPlayer` loads URL; if click was on timeline, also seek to offset
4. `video.ontimeupdate` → update `currentTime90k` → playhead moves in timeline
5. Click "Thiết lập xuất dữ liệu" → set `exportDialogOpen = true`

### Props to ArchiveActivity

```typescript
interface Props {
  Frame: React.ComponentType<FrameProps>;
  toplevel: api.ToplevelResponse;
  timeZoneName: string;
}
```

`App.tsx` passes `toplevel={toplevel}` and `timeZoneName={timeZoneName!}` to ArchiveActivity (same as current ListActivity).

---

## Section 2: Component Details

### TopBar

**Props:** `cameras`, `selectedCamera`, `onSelectCamera`, `selectedDate`, `onSelectDate`, `currentTime90k`, `timeZoneName`

- **Title:** "Xem lại bản ghi" — Typography h6 bold
- **Date picker:** MUI `DatePicker` — calendar icon + date formatted `DD-MM-YYYY` + dropdown arrow. Controlled by `selectedDate`
- **Time display:** clock icon + current playhead time `HH:mm` (derived from `currentTime90k`). Updates live as video plays
- **Camera chips:** one chip per camera — label `CAM 01`, `CAM 02`, etc. (index-based short name). Active chip: solid fire orange fill + white text. Inactive: outlined border + dim text. Single-select only
- **Grid icon button:** placeholder, no action

### VideoPlayer

**Props:** `activeRecording`, `selectedCamera`, `onTimeUpdate`, `onRecordingEnd`

- `<video>` fills a `16/9` aspect-ratio container; native `controls` hidden, custom controls rendered below
- **Overlay top-left:** `{camera.shortName}` pill (dark semi-transparent background, white text)
- **Overlay top-right:** `{HH:mm:ss} | {width}p {fps}fps` in JetBrains Mono
- **Custom controls:** `⏮ ⏪ ⏸/▶ ⏩ ⏭` centered row below video
  - `⏮`: seek to start of recording
  - `⏪`: rewind 10s
  - `⏸/▶`: toggle pause/play
  - `⏩`: fast-forward 10s
  - `⏭`: seek to end of recording (triggers `onRecordingEnd` → advance to next recording)
- **Empty state:** dark bg + centered text "Chọn một bản ghi để phát"
- **Video src:** `api.recordingUrl(camera.uuid, streamType, recording, false)` — no trim, no timestamp track

`onTimeUpdate(time90k: number)` is called from `video.ontimeupdate`. Converts `video.currentTime` (seconds) to 90k ticks: `recording.startTime90k + Math.floor(video.currentTime * 90000)`.

### TimelineScrubber

**Props:** `recordings`, `activeRecording`, `currentTime90k`, `viewRange90k`, `onSeek`, `onZoom`

**Rendering:**
- Container `div` with `position: relative`, full width, height ~80px, dark background
- Each `CombinedRecording` renders as an absolutely-positioned rect:
  - x = `(rec.startTime90k - viewRange90k[0]) / rangeWidth * containerWidth`
  - width = `(rec.endTime90k - rec.startTime90k) / rangeWidth * containerWidth`
  - color: `#ff572240` (inactive), `#ff5722` (active recording)
- **Playhead:** vertical line at `currentTime90k` position, color `#86cfff` (tertiary blue), height 100%
- **Playhead label:** `HH:mm:ss (Hiện tại)` above playhead, monospace font
- **Time labels:** hour marks within `viewRange90k`, rendered as absolute-positioned text below the track
- **Click:** `onClick` → compute `time90k` from `clientX` → find recording that contains it → call `onSeek(recording, time90k)`
- **Drag:** `onMouseDown` → `onMouseMove` while button held → call `onSeek` continuously with computed time90k → `onMouseUp` ends drag
- **Zoom controls:** two `IconButton` (ZoomOut / ZoomIn) below-right of track. 4 zoom levels: 1h / 4h / 8h / 24h window. `onZoom(level)` updates `viewRange90k` in parent

`viewRange90k` default: 1-hour window centered on `currentTime90k` (or full day if no recording playing).

### RecordingList

**Props:** `recordings`, `activeRecording`, `onSelect`, `loading`, `onExport`

- **Header:** "Danh sách bản ghi" + `CircularProgress` (size 16) visible when `loading`
- Each row:
  - **Thumbnail placeholder:** 48×36 dark rect, `borderRadius: 4px`
  - **Duration badge:** overlay bottom-right of thumbnail, format `M:SS`
  - **Time range:** `HH:mm - HH:mm` (JetBrains Mono, orange if active row)
  - **Label:** "Bản ghi hệ thống"
  - **Camera name:** `camera.shortName`, secondary text color
  - **Active row style:** `bgcolor: '#ff572215'`, `borderLeft: '2px solid #ff5722'`
- Click row → `onSelect(recording)`
- **Bottom bar (sticky):**
  - Text: `{recordings.length} đoạn phim` (or "0 đoạn phim")
  - Primary button: "Thiết lập xuất dữ liệu" — disabled when `activeRecording === null`
  - Click → `onExport()`

### ExportDialog

**Props:** `open`, `recording`, `camera`, `streamType`, `timeZoneName`, `onClose`

- **Title:** "Xuất đoạn phim"
- **Info row:** camera name + time range of recording (formatted with `timeZoneName`)
- **Trim start:** time input `HH:mm:ss`, default = recording start
- **Trim end:** time input `HH:mm:ss`, default = recording end
- **Timestamp track checkbox:** "Thêm timestamp vào video"
- **Download button:** generates `api.recordingUrl(camera.uuid, streamType, recording, timestampTrack, [trimStart90k, trimEnd90k])` → `window.open(url)` in new tab
- **Cancel button:** calls `onClose()`
- Trim inputs validated: start < end, both within recording bounds. Download button disabled if invalid

---

## Section 3: API Usage

### Fetch recordings for a day

```typescript
const startOf90k = toZonedTime(selectedDate, timeZoneName).setHours(0,0,0,0) / 1000 * 90000;
const endOf90k = startOf90k + 24 * 60 * 60 * 90000;

const resp = await api.recordings({
  cameraUuid: selectedCamera.uuid,
  stream: "main",  // always use "main" stream
  startTime90k: startOf90k,
  endTime90k: endOf90k,
}, { signal });

if (resp.status === "success") {
  resp.response.recordings.sort((a, b) => b.startId - a.startId);
  setRecordings(combine(undefined, resp.response));  // no split
}
```

Always uses the `"main"` stream. No split (one combined recording per continuous run).

### Generate playback URL

```typescript
api.recordingUrl(camera.uuid, "main", recording, false)
// → /api/cameras/{uuid}/main/view.mp4?s={startId}-{endId}&...
```

### Generate export URL with trim

```typescript
api.recordingUrl(
  camera.uuid,
  "main",
  recording,
  timestampTrack,
  [trimStart90k, trimEnd90k],
)
```

---

## Section 4: Testing

`ui/src/Archive/Archive.test.tsx` covers:

1. **Renders camera chips from toplevel** — mock `/api/` with 2 cameras, verify both chips appear
2. **Fetches recordings on mount** — mock recordings API, verify RecordingList shows correct time ranges
3. **Selecting a camera chip refetches** — click chip 2, verify new API call with camera 2's UUID
4. **Click recording plays video** — click a row in RecordingList, verify `<video src>` attribute is set
5. **Export button disabled when no active recording** — verify button disabled state
6. **Export dialog opens on export click** — click "Thiết lập xuất dữ liệu", verify dialog appears with correct camera name

---

## Self-Review

- No TBDs or placeholders
- `combine()` import path consistent throughout (`../List/VideoList`)
- `api.recordingUrl` signature consistent with `ui/src/api.ts:456`
- `App.tsx` change is minimal: swap `ListActivity` → `ArchiveActivity` for `/archive` route, pass same props
- Stream type hardcoded to `"main"` — consistent with Stitch design (no sub-stream selector in new UI)
- `viewRange90k` zoom logic lives in `index.tsx`, passed down to `TimelineScrubber` as prop — clean separation
- Export trim validation (start < end, within bounds) prevents generating invalid URLs
- `timeZoneName` threaded through to `ExportDialog` for correct time display
