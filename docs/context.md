# Project Context

## Purpose
- Sandbox repo for experimenting with OpenTUI and related terminal rendering workflows.

## Tech Stack
- Bun
- TypeScript
- OpenTUI (`@opentui/core`, `@opentui/react`)
- Jimp for image loading in character-cell fallback rendering

## Current Focus
- `splash-tui` now renders images in Ghostty + tmux using Kitty graphics placeholders, with a reusable `TerminalImage` component, character-cell fallback, and graceful handling when `img_dir/` is missing.
- The app now includes both `ImagePanel` and `ShowcasePanel` as consumers of the shared `TerminalImage` abstraction.
- `splash-tui` now includes a `ChartPanel` that plots an animated sine curve plus a static cosine reference with native OpenTUI buffer drawing.

## Key Docs
- `docs/architecture/image-rendering.md` - Kitty placeholder workflow, fallback renderer, and protocol notes.
