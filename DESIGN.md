# Skeleton Keypoint Labeler Design System

## 1. Atmosphere & Identity

This is a quiet, dark annotation workstation: dense enough for precision work,
but calm enough that the image remains the focal surface. The signature is an
amber selection signal that makes the active object and keypoint unmistakable
against the cool graphite workspace.

## 2. Color

### Palette

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Canvas background | `--bg` | `#16181d` | App and workspace background |
| Panel | `--panel` | `#1f2229` | Rails and inspector |
| Panel raised | `--panel-2` | `#262a33` | Rows, inputs, secondary controls |
| Canvas surface | `--canvas` | `#14161b` | Empty/template canvas |
| Border | `--border` | `#343945` | Structural dividers and control outlines |
| Primary text | `--text` | `#e8eaef` | Labels and instructions |
| Muted text | `--muted` | `#9aa1ad` | Hints and metadata |
| Accent | `--accent` | `#4f8cff` | Interactive focus and active image |
| Selection | `--selection` | `#ffd166` | Active object/keypoint identity |
| Danger | `--danger` | `#e5534b` | Delete and destructive actions |
| Skeleton line | `--skeleton` | `#b8c1d1` | Neutral edge geometry |
| Visible status | `--status-visible` | `#9ccc65` | `v=2`, 보임 |
| Occluded status | `--status-occluded` | `#ffd166` | `v=1`, 가려짐 |
| Absent status | `--status-absent` | `#78909c` | `v=0`, 없음 |
| Control text | `--control-text` | `#16181d` | Text on status controls |

Accent is reserved for interaction. Selection is a distinct semantic signal,
not decoration. Keypoint definition colors remain data-driven from the project
configuration.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Title | `22px` | 700 | 1.2 | Project/entry heading |
| Section | `15px` | 600 | 1.3 | Project name in rail |
| Body | `14px` | 400 | 1.5 | Controls and rows |
| Body small | `13px` | 400 | 1.45 | Section labels and legend |
| Caption | `12px` | 400 | 1.4 | Image names and hints |
| Micro | `11px` | 600 | 1.3 | Status badges and compact actions |

### Font Stack

- Primary: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`
- Mono: system monospace only when data values require it.

Body text stays at or above `12px` for the dense workstation controls and at
or above `13px` for task instructions.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a 4px base unit.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | List gaps and compact separation |
| `--space-2` | `8px` | Inline controls and row padding |
| `--space-3` | `12px` | Panel padding and control groups |
| `--space-4` | `16px` | Canvas padding and toolbar rhythm |
| `--space-6` | `24px` | Centered setup surface |
| `--space-8` | `32px` | Setup card padding |

### Grid

- Wide shell: `230px` image rail, fluid canvas, `260px` inspector.
- Tablet shell (`768px`): `196px` image rail, fluid canvas, inspector below.
- Narrow shell (`375px`): one readable column, image rail first, canvas second,
  inspector last.
- Breakpoints: `640px`, `768px`, and `1024px`.
- The canvas is the primary visual surface; the image rail, canvas, and
  inspector own their own scroll regions only when content requires it.

## 5. Components

### Labeler shell

- **Structure**: image rail / canvas workspace / selection inspector.
- **Variants**: wide three-column, tablet two-row, narrow single-column.
- **Spacing**: `--space-2` to `--space-4`.
- **States**: empty image, active image, selected object, selected keypoint.
- **Accessibility**: named landmarks, keyboard-reachable rows and controls,
  visible focus ring, no primary-content horizontal scroll at 375px.
- **Motion**: no decorative motion; active controls use immediate color and
  selection feedback.
- **Layout**: `list-detail` shell; the image rail and inspector scroll lists,
  while the canvas workspace keeps image geometry intact.

### Selection identity

- **Structure**: selected object outline + `객체 N` canvas marker + selected
  keypoint ring/label + inspector row highlight.
- **Variants**: object selected, keypoint selected, absent keypoint selected.
- **Spacing**: `--space-1` and `--space-2`.
- **States**: default, hover, active, focus, selected.
- **Accessibility**: selected rows expose `aria-pressed`; object/keypoint names
  remain visible in the inspector even when a point has `v=0`.
- **Motion**: none required; identity must remain stable during pointer edits.
- **Layout**: cluster inside the canvas and stack inside the inspector.

### Visibility control

- **Structure**: a three-option control labelled `1 없음`, `2 가려짐`,
  `3 보임`.
- **Variants**: `v=0`, `v=1`, `v=2`.
- **Spacing**: `--space-1` between options.
- **States**: default, hover, active, focus; active option is reflected by
  `aria-pressed` and status color.
- **Accessibility**: a native `radiogroup` exposes each option as `role=radio`
  with `aria-checked`, clear Korean labels, and keyboard shortcuts `1/2/3`;
  the user-facing numbers intentionally map to data values `0/1/2`.
- **Motion**: tactile `transform` press feedback only; reduced motion removes
  the transform transition.
- **Layout**: wrapping cluster so controls remain usable at 375px.

### Session autosave child

- **Structure**: headless `SessionAutosave` as the final child of the labeler
  shell, receiving project/config/image/session state.
- **Variants**: new labeling run and resumed run with restored session metadata.
- **Spacing**: no visual footprint.
- **States**: idle, debounced save, page-hide flush.
- **Accessibility**: no focusable or visible controls; persistence does not
  change the direct sidebar/main/inspector child order.
- **Motion**: none.
- **Layout**: shell integration only; no scroll owner.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|------|----------|-------------|-------|
| Micro press | `100ms` | `ease-out` | Visibility button press |
| Focus/selection | immediate | none | Annotation identity and precision |

Only `transform` and `opacity` are animated. Selection and visibility changes
are immediate so annotation state never feels delayed. `prefers-reduced-motion:
reduce` disables the micro press transform.

The visibility control adapts the beui.dev Radio Group mechanism: one active
choice is represented by a native button with `aria-pressed`, while the
project's simpler CSS implementation avoids adding a motion dependency. The
interaction is intentionally instant because this is a precision tool.

## 7. Depth & Surface

### Strategy: mixed

Panels use a cool tonal shift (`--panel` to `--panel-2`) with 1px structural
borders. No drop shadows are needed. The selected object uses a dashed amber
identity ring and a tonal fill change; status controls use semantic fills.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- WCAG 2.2 AA target; maintain at least 4.5:1 body-text contrast.
- Every native control has a visible `:focus-visible` state.
- Object/keypoint selection is available from the inspector without relying on
  pointer-only canvas interaction.
- Visibility status is available through labelled buttons and `1/2/3` shortcuts.
- The narrow layout reflows to one readable column with no horizontal scrolling
  of primary content.
- Respect `prefers-reduced-motion` for all interaction feedback.

### Accepted Debt

| Item | Location | Why accepted | Owner / Exit |
|------|----------|--------------|--------------|
| React dev tooling is not installed | `package.json`, `src/main.jsx` | Those files are owned by the resume/undo peers in this parallel task | Lead integration pass |
