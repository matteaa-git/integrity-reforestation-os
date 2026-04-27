// Photo editing controls — maps to CSS filters + vignette overlay

export interface PhotoEdits {
  // Tone
  exposure:       number; // -100 to +100, default 0
  brilliance:     number; // -100 to +100, default 0
  highlights:     number; // -100 to +100, default 0
  shadows:        number; // -100 to +100, default 0
  contrast:       number; // -100 to +100, default 0
  blackPoint:     number; // -100 to +100, default 0
  // Color
  saturation:     number; // -100 to +100, default 0
  vibrance:       number; // -100 to +100, default 0
  warmth:         number; // -100 to +100, default 0 (neg=cool, pos=warm)
  tint:           number; // -100 to +100, default 0 (neg=green, pos=magenta)
  // Detail
  sharpness:      number; //    0 to +100, default 0
  definition:     number; // -100 to +100, default 0
  noiseReduction: number; //    0 to +100, default 0
  // Vignette (handled as overlay, not CSS filter)
  vignette:       number; //    0 to +100, default 0
}

export const DEFAULT_PHOTO_EDITS: PhotoEdits = {
  exposure: 0, brilliance: 0, highlights: 0, shadows: 0,
  contrast: 0, blackPoint: 0, saturation: 0, vibrance: 0,
  warmth: 0, tint: 0, sharpness: 0, definition: 0,
  noiseReduction: 0, vignette: 0,
};

export function isDefaultEdits(e: PhotoEdits): boolean {
  return Object.keys(DEFAULT_PHOTO_EDITS).every(
    (k) => e[k as keyof PhotoEdits] === DEFAULT_PHOTO_EDITS[k as keyof PhotoEdits]
  );
}

/**
 * Compute a CSS filter string from photo edits.
 * Controls are combined into brightness, contrast, saturate, hue-rotate, sepia, blur.
 */
export function computePhotoFilter(e: PhotoEdits): string {
  // Brightness: exposure (main), brilliance (local-like), highlights & shadows (directional)
  const bMul =
    (1 + e.exposure       * 0.005) *
    (1 + e.brilliance     * 0.003) *
    (1 + e.highlights     * 0.002) *
    (1 + e.shadows        * 0.0015);

  // Contrast: base contrast, definition, black point, sharpness micro-contrast
  const cMul =
    (1 + e.contrast       * 0.008) *
    (1 + e.definition     * 0.005) *
    (1 + e.blackPoint     * 0.005) *
    (1 + e.sharpness      * 0.003) *
    (1 - e.brilliance     * 0.001) *  // brilliance softens micro-contrast
    (1 - e.shadows        * 0.0005);  // shadow lift reduces contrast slightly

  // Saturation: base + vibrance (vibrance is gentler)
  const sMul = Math.max(0,
    (1 + e.saturation     * 0.01) *
    (1 + e.vibrance       * 0.006)
  );

  // Warmth → sepia toning + hue shift toward yellow/red
  const warmthSepia = e.warmth > 0 ? Math.min(1, e.warmth * 0.005) : 0;
  const warmthHue   = -e.warmth * 0.15;

  // Tint → hue rotation (positive = magenta/red, negative = green)
  const totalHue = warmthHue + e.tint * 0.5;

  // Noise reduction → very subtle blur (max ~2px at 100)
  const noiseBlur = e.noiseReduction * 0.02;

  const parts: string[] = [
    `brightness(${Math.max(0.05, bMul).toFixed(3)})`,
    `contrast(${Math.max(0.1, cMul).toFixed(3)})`,
    `saturate(${sMul.toFixed(3)})`,
  ];
  if (Math.abs(totalHue) > 0.1) parts.push(`hue-rotate(${totalHue.toFixed(1)}deg)`);
  if (warmthSepia > 0.005)      parts.push(`sepia(${warmthSepia.toFixed(3)})`);
  if (noiseBlur > 0.05)         parts.push(`blur(${noiseBlur.toFixed(2)}px)`);

  return parts.join(" ");
}

// Preset storage (localStorage)
export interface PhotoPreset {
  id: string;
  name: string;
  edits: PhotoEdits;
}

const STORAGE_KEY = "ig-story-photo-presets";

export function loadPresets(): PhotoPreset[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function savePreset(name: string, edits: PhotoEdits): PhotoPreset[] {
  const presets = loadPresets();
  const preset: PhotoPreset = { id: crypto.randomUUID(), name, edits };
  const updated = [...presets, preset];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deletePreset(id: string): PhotoPreset[] {
  const updated = loadPresets().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
