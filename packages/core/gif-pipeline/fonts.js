// packages/core/gif-pipeline/fonts.js
// Registers bundled fonts with @napi-rs/canvas at import time.
// Importing this module has the side effect of making 'Inter' available
// as a canvas font family.
//
// Inter is bundled as a variable font (Inter-Variable.ttf) covering all
// weights Thin → Black in a single file. Skia (the backend used by
// @napi-rs/canvas) selects the correct weight at render time based on
// `ctx.font` (e.g. 'bold 48px Inter' picks the Bold axis position).

import { GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let registered = false;

export function ensureFontsRegistered() {
  if (registered) return;
  const interVariablePath = path.join(__dirname, 'fonts', 'Inter-Variable.ttf');
  GlobalFonts.registerFromPath(interVariablePath, 'Inter');
  registered = true;
  console.log('[gif-pipeline:fonts] Registered Inter (variable) from', interVariablePath);
}
