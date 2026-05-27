# Merge Stitch UI into Hoan Thien Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the full Stitch-designed UI on the `hoan_thien` branch by integrating the existing `worktree-stitch-shell-camera-management` branch safely.

**Architecture:** Preserve the current `hoan_thien` working tree with a checkpoint commit, then merge the Stitch UI branch so its app shell, dashboard, settings, cameras, and archive UI become the active frontend. Resolve conflicts by keeping the Stitch UI for frontend presentation while preserving any newer `hoan_thien` behavior or API compatibility that is not contradicted by the Stitch design.

**Tech Stack:** Git, React, TypeScript, MUI, React Router, Vitest, Vite

---

## File map

### Branches involved

- Current branch: `hoan_thien` — target branch that should receive the Stitch UI.
- Source branch: `worktree-stitch-shell-camera-management` — branch containing the Stitch UI implementation.
- Reference branch: `master` — not the direct target for this operation.

### Files likely to be modified by the merge

- `ui/src/App.tsx` — route wiring and shell entry point.
- `ui/src/App.test.tsx` — route and shell tests.
- `ui/src/components/AppShell.tsx` — Stitch app shell from source branch.
- `ui/src/components/Header.tsx` — current `hoan_thien` header changes may conflict with shell navigation.
- `ui/src/Cameras/index.tsx` — Stitch camera management page.
- `ui/src/Cameras/AddEditDialog.tsx` — dark Stitch camera dialog.
- `ui/src/Dashboard/index.tsx` and `ui/src/Dashboard/*` — Stitch dashboard modules.
- `ui/src/Settings/index.tsx` and `ui/src/Settings/*` — Stitch settings modules.
- `ui/src/Archive/index.tsx` and `ui/src/Archive/*` — Stitch archive playback UI.
- `ui/src/api.ts` — shared API types and functions used by Stitch pages.
- `ui/package.json` and `ui/package-lock.json` — dependency changes from the source branch.

### Files to avoid accidentally committing unless intentionally needed

- `.claude/**` — local agent state and worktree metadata.
- `node_modules/**` — installed dependencies.

---

### Task 1: Capture the current `hoan_thien` state

**Files:**
- Inspect: working tree status only.
- Modify: git index and new checkpoint commit.

- [ ] **Step 1: Confirm branch and uncommitted files**

Run:

```bash
git status --short --branch
```

Expected: branch is `hoan_thien`; modified and untracked files are visible.

- [ ] **Step 2: Review the current diff summary**

Run:

```bash
git diff --stat && git diff --cached --stat
```

Expected: unstaged changes are summarized; staged changes may be empty.

- [ ] **Step 3: Stage only project source files, not local agent state or dependencies**

Run:

```bash
git add docs/superpowers/plans/2026-05-27-merge-stitch-ui-into-hoan-thien.md \
  docs/superpowers/plans/2026-05-26-archive-playback.md \
  ui/src/App.test.tsx \
  ui/src/App.tsx \
  ui/src/Cameras/AddEditDialog.tsx \
  ui/src/Cameras/AddEditDialog.test.tsx \
  ui/src/Cameras/index.tsx \
  ui/src/Cameras/index.test.tsx \
  ui/src/Dashboard.tsx \
  ui/src/Dashboard.test.tsx \
  ui/src/SignalControls.tsx \
  ui/src/SignalControls.test.tsx \
  ui/src/SystemHealth.tsx \
  ui/src/SystemHealth.test.tsx \
  ui/src/Users/index.tsx \
  ui/src/Users/index.test.tsx \
  ui/src/api.ts \
  ui/src/components/Header.tsx \
  ui/src/components/Header.test.tsx \
  ui/src/Login.tsx
```

Expected: the intended application files are staged; `.claude/` and `node_modules/` are not staged.

- [ ] **Step 4: Verify staged files before committing**

Run:

```bash
git diff --cached --stat && git status --short
```

Expected: staged files match Step 3; `.claude/` and `node_modules/` remain untracked.

- [ ] **Step 5: Commit the checkpoint**

Run:

```bash
git commit -m "$(cat <<'EOF'
chore: checkpoint hoan thien before Stitch UI merge

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: a new checkpoint commit is created on `hoan_thien`.

---

### Task 2: Merge the Stitch UI branch

**Files:**
- Modify: files touched by Git merge.

- [ ] **Step 1: Merge without auto-committing**

Run:

```bash
git merge --no-commit --no-ff worktree-stitch-shell-camera-management
```

Expected: either a clean staged merge or conflict markers requiring manual resolution.

- [ ] **Step 2: List merge conflicts if any**

Run:

```bash
git status --short
```

Expected: conflicted files show with `UU`, `AA`, `DU`, or related conflict status. If there are no conflicts, continue to Task 3.

- [ ] **Step 3: Resolve frontend conflicts with Stitch UI as presentation source**

For conflicts in UI presentation files, keep the source branch's Stitch implementation unless it would remove required API compatibility from `hoan_thien`.

Likely files and resolution rule:

```text
ui/src/App.tsx                  keep Stitch shell/routes; preserve working auth/toplevel fetch behavior
ui/src/Cameras/index.tsx        keep Stitch camera page; preserve any newer API field mapping if needed
ui/src/Cameras/AddEditDialog.tsx keep Stitch dialog; preserve save/update behavior
ui/src/components/Header.tsx    remove if superseded by AppShell, or keep only if still imported
ui/src/api.ts                   merge type/API additions from both branches
```

Expected: no conflict markers remain in source files.

- [ ] **Step 4: Stage resolved files**

Run:

```bash
git add ui docs server package.json package-lock.json 2>/dev/null || git add ui docs server
```

Expected: all resolved files are staged. If `package.json` or `package-lock.json` do not exist at repo root, the fallback stages the relevant project directories.

---

### Task 3: Validate the merged UI at the code level

**Files:**
- Inspect/modify only if tests expose real merge issues.

- [ ] **Step 1: Install UI dependencies if required**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm install
```

Expected: dependencies install and `package-lock.json` is up to date.

- [ ] **Step 2: Run UI tests**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm test -- --run
```

Expected: all Vitest tests pass. If tests fail, apply `superpowers:systematic-debugging` before fixing.

- [ ] **Step 3: Run TypeScript/build validation**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm run build
```

Expected: build completes successfully.

- [ ] **Step 4: Fix only root-cause merge issues**

If Step 2 or Step 3 fails, identify the exact failing file and root cause before editing. Typical acceptable fixes:

```text
- restore an API export that one branch expects
- update a test query to match the Stitch UI text that now intentionally renders
- remove an import of a component replaced by AppShell
- reconcile duplicate route definitions after merge
```

Expected: each fix is tied to a failing test/build error, not speculative cleanup.

---

### Task 4: Verify the Stitch UI in the browser

**Files:**
- Inspect/modify only if manual verification exposes real UI breakage.

- [ ] **Step 1: Start the UI dev server**

Run:

```bash
cd /home/ai/dev/moonfire-nvr/ui && npm run dev -- --host 127.0.0.1
```

Expected: Vite reports a local URL.

- [ ] **Step 2: Open the app in a browser**

Use Playwright to navigate to the Vite URL reported in Step 1.

Expected: the app loads without a blank screen or console error loop.

- [ ] **Step 3: Verify primary Stitch screens**

Check these routes or navigation items, depending on auth state:

```text
/cameras   Stitch camera management page and dark add/edit dialog
/dashboard Stitch dashboard shell/cards/activity layout
/archive   Stitch archive playback layout
/settings  Stitch settings layout
```

Expected: pages use the Stitch dark shell rather than the old/default UI.

- [ ] **Step 4: Check browser console**

Use Playwright console inspection.

Expected: no uncaught runtime errors related to missing components, missing API exports, or invalid routes.

---

### Task 5: Commit the completed merge

**Files:**
- Modify: git history only.

- [ ] **Step 1: Verify final staged diff**

Run:

```bash
git status --short && git diff --cached --stat
```

Expected: merge result is staged; `.claude/` and `node_modules/` are not staged.

- [ ] **Step 2: Commit the merge**

Run:

```bash
git commit -m "$(cat <<'EOF'
feat(ui): restore Stitch-designed interface

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: merge commit is created on `hoan_thien`.

- [ ] **Step 3: Confirm branch state**

Run:

```bash
git status --short --branch && git log --oneline --decorate -5
```

Expected: `hoan_thien` contains the checkpoint and Stitch UI merge commits; only intentionally ignored/untracked local files remain.

---

## Self-review

- Spec coverage: the plan integrates the existing Stitch branch into `hoan_thien`, protects current work with a checkpoint, resolves conflicts, validates tests/build, verifies the UI manually, and commits the result.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: branch names, file paths, and commands are consistent across tasks.
