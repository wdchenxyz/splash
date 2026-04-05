## Documentation: Renderer Startup And Troubleshooting Guide

### Problem
Splash's user-facing docs currently explain the happy path but leave out several runtime behaviors and failure modes that are already part of the product contract.

- The README describes the browser renderer as fixed at `localhost:3456` ([README.md](/Users/wdchen/Workspace/splash/README.md#L45)), but the actual server retries up to ten ports on `EADDRINUSE` and returns the bound URL dynamically ([src/browser-server.ts](/Users/wdchen/Workspace/splash/src/browser-server.ts#L7), [src/browser-server.ts](/Users/wdchen/Workspace/splash/src/browser-server.ts#L104), [src/browser-server.ts](/Users/wdchen/Workspace/splash/src/browser-server.ts#L117), [src/browser-server.ts](/Users/wdchen/Workspace/splash/src/browser-server.ts#L187)).
- The README lists a tmux image prerequisite as `tmux set -g allow-passthrough all` ([README.md](/Users/wdchen/Workspace/splash/README.md#L17)), while the image design spec documents `tmux set -g allow-passthrough on` as the required setting ([docs/superpowers/specs/2026-03-27-image-rendering-design.md](/Users/wdchen/Workspace/splash/docs/superpowers/specs/2026-03-27-image-rendering-design.md#L102)). That mismatch creates unnecessary setup ambiguity for the one renderer path that already has strict terminal requirements.
- `render-tmux` and `render-browser` both expose concrete recovery guidance in code, but none of it is surfaced in user docs. Examples: tmux requires running Claude Code inside a tmux session ([src/tmux-manager.ts](/Users/wdchen/Workspace/splash/src/tmux-manager.ts#L29)), browser auto-open can fall back to a "refresh if needed" flow ([src/index.ts](/Users/wdchen/Workspace/splash/src/index.ts#L198)), and both tools emit renderer-connection failure messages ([src/index.ts](/Users/wdchen/Workspace/splash/src/index.ts#L114), [src/index.ts](/Users/wdchen/Workspace/splash/src/index.ts#L208)).
- There is no dedicated troubleshooting or runtime-operations document under `docs/`; today the directory only contains the PRD, proposals, shadcn component notes, and implementation-planning material (`docs/` listing).

### Proposed Change
Create one operational documentation slice focused on renderer startup, environment prerequisites, and recovery steps.

- Create `docs/troubleshooting.md` with short sections for:
  - tmux prerequisites: must already be inside tmux, supported pane positions/sizes, image rendering terminal requirements, and the correct `allow-passthrough` command.
  - browser startup behavior: default port, automatic port fallback when 3456 is busy, auto-open behavior, manual open/refresh fallback, and what `close-browser` actually resets.
  - common failure messages copied from current runtime strings, paired with the action users should take next.
  - image-specific runtime notes: absolute local file paths only, browser `/files/<base64url>` rewriting, unsupported non-image extensions.
- Update `README.md` to keep the top-level setup concise but link directly to the new troubleshooting guide from the Requirements and Renderers sections.
- Correct the browser renderer wording in `README.md` so it says "starts at 3456 and may bind the next available port" instead of implying a fixed URL.
- Correct the tmux image prerequisite wording in `README.md` so the setup command matches the documented implementation behavior.
- Add one lightweight docs check or CI script that greps for the exact `allow-passthrough` snippet and the browser-port wording in `README.md`, so these operational docs do not drift again during future renderer changes.

### Impact
- **Effort**: S
- **Risk**: Low
- **Value**: This removes avoidable setup failures for first-time users, reduces support/debug time around renderer startup, and makes Splash's runtime behavior legible without reading source code.

### Dependencies
- The current runtime strings in `src/index.ts`, `src/browser-server.ts`, and `src/tmux-manager.ts` should remain the source of truth while the guide is written.
- If the project later changes tmux passthrough requirements or browser port strategy, the new docs check must be updated in the same change.
