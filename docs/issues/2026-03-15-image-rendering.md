# Image Rendering In `splash-tui`

## Problem
- Half-block rendering worked but stayed visibly blocky because it is limited by terminal cell resolution.
- Raw Kitty graphics placement did not show any image inside OpenTUI.

## Root Cause
- The raw Kitty attempt used cursor-based placement plus direct `process.stdout.write()` APC commands.
- OpenTUI redraws the screen independently, so that approach was fragile inside a managed TUI.
- It also used `t=t` temporary-file transport, which is stricter than normal file transport and can fail depending on terminal handling.
- During the placeholder migration, the renderer output bridge still crashed because `renderer.writeOut()` was called without binding `this`, causing `this.rendererPtr` to be undefined at runtime.

## Fix
- Switch Kitty rendering to Unicode placeholder mode.
- Transmit the image with Kitty graphics, then create a virtual placement (`U=1`).
- Render placeholder characters inside the OpenTUI text tree so redraws keep the image anchored.
- Use normal file transport (`t=f`) instead of temp-file auto-delete transport.
- Route Kitty APC output through the real OpenTUI renderer write path with the correct method binding.
- Fix no-payload Kitty commands so placement/delete commands are emitted without a trailing `;`.
- Size Kitty placeholder regions to the fitted image dimensions instead of the full content width, which removes leftover overlay artifacts.
- Collapse the per-panel controls into the info line so text does not render underneath the image overlay.
- Fall back to the character-cell backend automatically if Kitty rendering throws.
- Discover images dynamically from `img_dir/` and degrade gracefully when the directory is absent.
- Keep the existing half-block renderer as a fallback backend.

## Lesson Learned
- In terminal apps with their own rendering loop, image protocols work best when the terminal image is attached to text placeholders that survive redraws, rather than raw cursor-positioned side effects.
