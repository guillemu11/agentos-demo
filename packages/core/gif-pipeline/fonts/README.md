# Bundled Fonts

These fonts are bundled for use by the GIF pipeline Mode C (Typographic).

## Inter

- **File:** `Inter-Variable.ttf`
- **Type:** Variable font (opsz + wght axes) — a single file covers Thin → Black weights
- **License:** SIL Open Font License 1.1
- **Source:** https://github.com/google/fonts/tree/main/ofl/inter
- **Copyright:** The Inter Project Authors (https://github.com/rsms/inter)

Registered with `@napi-rs/canvas` as the `Inter` family via `GlobalFonts.registerFromPath()` in `../fonts.js`. Skia (which `@napi-rs/canvas` uses) selects the correct weight from the variable font at render time when you set `ctx.font = 'bold 48px Inter'`.

Additional weights / families will be added here as new presets require them.
