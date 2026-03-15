# Image Rendering

## Goal
- Render images in `splash-tui` with high fidelity in Kitty-compatible terminals.
- Keep a working fallback for terminals that do not support Kitty graphics.
- Expose a reusable image-rendering module so future screens can render images without copying panel-specific logic.

## Reusable API

### Main Component
- `splash-tui/src/components/TerminalImage.tsx`

### What It Owns
- backend selection (`auto`, `kitty`, `cell`)
- Kitty transmit / placement lifecycle
- framebuffer lifecycle for cell fallback
- image loading and caching
- runtime fallback from Kitty to cell
- structured render state reporting via `onStateChange`

### Inputs
- `src`
- `area` (`left`, `top`, `cols`, `rows`)
- `backend`
- `mode`
- `scaleMode`

### Outputs
- Imperative rendering into the OpenTUI renderer tree
- state updates that consumers can use to build status text or controls

## Main Path: Kitty Placeholders

### Files
- `splash-tui/src/components/TerminalImage.tsx`
- `splash-tui/src/components/panels/ImagePanel.tsx`
- `splash-tui/src/lib/kitty-graphics.ts`
- `splash-tui/src/lib/kitty-diacritics.ts`

### Workflow
1. `ImagePanel` only handles browsing UI and passes the selected image plus render area into `TerminalImage`.
2. `TerminalImage` chooses the backend based on props plus `detectKittySupport()`.
3. `computeKittyPlacement()` converts terminal size plus pixel resolution into a fitted image rectangle in terminal cells.
4. `createRendererKittyWriter()` bridges Kitty APC writes into OpenTUI's renderer output path so the commands travel through the same stream as the TUI.
5. `createVirtualImage()` does two protocol steps:
   - `transmitImageFile()` sends the image by file path using Kitty graphics file transport.
   - `createVirtualPlacement()` creates a virtual image placement with `U=1` so the image can attach to Unicode placeholders.
6. `buildPlaceholderText()` creates a grid of placeholder cells using:
   - base char `U+10EEEE`
   - one combining mark for the row
   - one combining mark for the column
7. `TerminalImage` renders that placeholder grid inside a normal `TextRenderable`.
8. Ghostty sees the placeholders plus the virtual placement and paints the actual image over those cells.

### Why This Works
- The image is anchored to text that lives inside the OpenTUI render tree.
- Redraws do not lose the image because the placeholder text is rendered every frame.
- tmux passthrough wraps Kitty APC commands so they reach the outer terminal.

### Protocol Notes
- File transmit command:
  - `ESC_G a=t,f=100,t=f,i=<id>,q=2 ; <base64(file path)> ESC\\`
- Virtual placement command:
  - `ESC_G a=p,U=1,i=<id>,c=<cols>,r=<rows>,C=1,q=2 ESC\\`
- Delete command:
  - `ESC_G a=d,d=I,i=<id>,q=2 ESC\\`

### Render Flow
```text
OpenTUI ImagePanel
  -> select source image and layout area
  -> TerminalImage
       -> detect Kitty support
       -> compute fitted cell rect
       -> send Kitty transmit command
       -> send Kitty virtual placement command
       -> render placeholder text in TextRenderable
       -> Ghostty paints pixels over placeholder cells
```

## Fallback Path: Character Cells

### Files
- `splash-tui/src/lib/image-renderer.ts`

### Workflow
1. If Kitty is unavailable or throws, `TerminalImage` falls back to the `cell` backend.
2. The image is loaded through Jimp.
3. The image is resized to fit or fill the available area.
4. `FrameBufferRenderable` draws either:
   - color half-block cells using `▀`
   - grayscale supersampled output using OpenTUI buffer helpers

### Tradeoff
- This path is portable and robust.
- It is limited by terminal cell resolution, so it is visibly blockier than Kitty graphics.

## Failure Modes
- If `img_dir/` is missing, the panel shows a friendly message instead of crashing.
- If Kitty rendering fails at runtime, `TerminalImage` falls back to the cell backend and reports a note.
- If tmux passthrough is disabled, Kitty support detection returns false and the app starts in cell mode.

## Key Lesson
- For full-screen TUIs, Kitty images should be attached to Unicode placeholders inside the app's layout tree rather than painted with raw cursor side effects.
