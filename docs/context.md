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

## Key Docs
- `docs/architecture/image-rendering.md` - Kitty placeholder workflow, fallback renderer, and protocol notes.
