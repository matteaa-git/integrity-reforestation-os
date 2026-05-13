/**
 * Lightweight GeoPDF (OGC) metadata parser + WGS84 → image-pixel projector.
 *
 * Works against the format ArcGIS exports: a /VP[<<...>>] viewport entry with
 * /BBox, /GPTS (4 lat-lng corners), and /LPTS (matching unit-square corners).
 * Reads the raw PDF bytes as a latin1 string — the metadata is plain ASCII so
 * scanning for the tokens is safe regardless of stream compression.
 *
 * GPS is provided in WGS84 by the browser's geolocation API. NAD83 and WGS84
 * differ by less than one metre in North America, well below GPS accuracy,
 * so we treat them as the same datum and skip projection conversion.
 */

export interface GeoPdfCorner {
  /** Unit-square coords inside the BBox: [u, v] where u=0 is left, v=0 is bottom. */
  lpt: [number, number];
  /** Geographic coords: [lat, lng]. */
  geo: [number, number];
}

export interface GeoPdfMeta {
  /** PDF-space rectangle (in points) where the map graphic lives: [x1, y1, x2, y2]. */
  bbox: [number, number, number, number];
  /** Page size in PDF points: [width, height]. */
  pageSize: [number, number];
  /** Four registration corners. */
  corners: [GeoPdfCorner, GeoPdfCorner, GeoPdfCorner, GeoPdfCorner];
}

function parseNumberList(s: string): number[] {
  return s.trim().split(/\s+/).map(Number).filter(n => Number.isFinite(n));
}

/** Parse /VP /BBox /GPTS /LPTS out of an already-extracted text region. */
function parseFromText(haystack: string, pageSize: [number, number]): GeoPdfMeta | null {
  const vpStart = haystack.indexOf("/VP[");
  if (vpStart < 0) return null;
  const vpChunk = haystack.substring(vpStart, vpStart + 16_384);

  const bboxMatch = vpChunk.match(/\/BBox\s*\[\s*([-\d.\s]+?)\s*\]/);
  const gptsMatch = vpChunk.match(/\/GPTS\s*\[\s*([-\d.\s]+?)\s*\]/);
  const lptsMatch = vpChunk.match(/\/LPTS\s*\[\s*([-\d.\s]+?)\s*\]/);
  if (!bboxMatch || !gptsMatch || !lptsMatch) return null;

  const bboxNums = parseNumberList(bboxMatch[1]);
  const gpts = parseNumberList(gptsMatch[1]);
  const lpts = parseNumberList(lptsMatch[1]);
  if (bboxNums.length !== 4 || gpts.length !== 8 || lpts.length !== 8) return null;

  const corners: [GeoPdfCorner, GeoPdfCorner, GeoPdfCorner, GeoPdfCorner] = [
    { lpt: [lpts[0], lpts[1]], geo: [gpts[0], gpts[1]] },
    { lpt: [lpts[2], lpts[3]], geo: [gpts[2], gpts[3]] },
    { lpt: [lpts[4], lpts[5]], geo: [gpts[4], gpts[5]] },
    { lpt: [lpts[6], lpts[7]], geo: [gpts[6], gpts[7]] },
  ];
  return { bbox: bboxNums as [number, number, number, number], pageSize, corners };
}

/** Decode a deflate stream via the browser's native DecompressionStream API. */
async function inflate(input: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = new Response(new Blob([input as BlobPart])).body!
      .pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Parse OGC GeoPDF metadata. First scans the raw PDF as text; if /VP isn't
 * directly visible (because the page dict was packed into a compressed Object
 * Stream — PDF 1.5+ feature ArcGIS uses for newer maps like "Km 78 79.pdf"),
 * falls back to inflating every FlateDecode stream and searching those.
 */
export async function parseGeoPdf(bytes: ArrayBuffer): Promise<GeoPdfMeta | null> {
  const fullText = new TextDecoder("latin1").decode(bytes);

  // MediaBox is always uncompressed (top-level page dict reference).
  const mediaMatch = fullText.match(/\/MediaBox\s*\[\s*([-\d.\s]+?)\s*\]/);
  const mediaNums = mediaMatch ? parseNumberList(mediaMatch[1]) : [0, 0, 612, 792];
  const pageSize: [number, number] = [
    mediaNums[2] - mediaNums[0],
    mediaNums[3] - mediaNums[1],
  ];

  // Fast path: VP is in plain text (most ArcGIS exports we've seen).
  const direct = parseFromText(fullText, pageSize);
  if (direct) return direct;

  // Slow path: walk every stream...endstream block, try to inflate it, and
  // search the decompressed contents for /VP. This catches PDFs whose page
  // dictionaries are stored inside a /Type/ObjStm compressed object.
  const raw = new Uint8Array(bytes);
  const streamRe = /\bstream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(fullText)) !== null) {
    const dataStart = m.index + m[0].length;
    const endIdx = fullText.indexOf("endstream", dataStart);
    if (endIdx < 0) continue;
    // Trim trailing \r\n / \n before endstream
    let dataEnd = endIdx;
    if (fullText[dataEnd - 1] === "\n") dataEnd--;
    if (fullText[dataEnd - 1] === "\r") dataEnd--;
    if (dataEnd <= dataStart) continue;

    const compressed = raw.subarray(dataStart, dataEnd);
    const decompressed = await inflate(compressed);
    if (!decompressed) continue;
    const decText = new TextDecoder("latin1").decode(decompressed);
    if (!decText.includes("/VP[")) continue;
    const hit = parseFromText(decText, pageSize);
    if (hit) return hit;
  }

  return null;
}

/**
 * Solve the inverse bilinear interpolation: given a target point and the four
 * geographic corners, find the (u, v) ∈ [0,1]² that maps to it.
 *
 * The corners are passed in LPTS order — typically bottom-left, top-left,
 * top-right, bottom-right (Bounds [0 0 0 1 1 1 1 0]). We reorder them
 * internally by their lpt values so the math is unambiguous.
 *
 * Returns null if the solution doesn't converge (which would indicate the
 * point is far outside the map).
 */
export function geoToUnitSquare(
  lat: number,
  lng: number,
  corners: GeoPdfMeta["corners"],
): [number, number] | null {
  // Pick the corner closest to each unit-square vertex (BL=(0,0), TL=(0,1), TR=(1,1), BR=(1,0)).
  // ArcGIS conventionally emits them in that exact order, but be defensive.
  const pick = (u: number, v: number) =>
    corners.reduce((best, c) => {
      const d = Math.hypot(c.lpt[0] - u, c.lpt[1] - v);
      return d < best.d ? { d, c } : best;
    }, { d: Infinity, c: corners[0] }).c.geo;

  const p00 = pick(0, 0); // [lat, lng]
  const p01 = pick(0, 1);
  const p11 = pick(1, 1);
  const p10 = pick(1, 0);

  const target: [number, number] = [lat, lng];

  // 2D Newton solve.
  let u = 0.5, v = 0.5;
  for (let iter = 0; iter < 24; iter++) {
    // Forward bilinear evaluation.
    const a = (1 - u) * (1 - v);
    const b = (1 - u) * v;
    const c = u * v;
    const d = u * (1 - v);
    const fx = a * p00[0] + b * p01[0] + c * p11[0] + d * p10[0];
    const fy = a * p00[1] + b * p01[1] + c * p11[1] + d * p10[1];
    const dx = target[0] - fx;
    const dy = target[1] - fy;
    if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) return [u, v];

    // Jacobian.
    const dfdu_x = (1 - v) * (p10[0] - p00[0]) + v * (p11[0] - p01[0]);
    const dfdu_y = (1 - v) * (p10[1] - p00[1]) + v * (p11[1] - p01[1]);
    const dfdv_x = (1 - u) * (p01[0] - p00[0]) + u * (p11[0] - p10[0]);
    const dfdv_y = (1 - u) * (p01[1] - p00[1]) + u * (p11[1] - p10[1]);

    const det = dfdu_x * dfdv_y - dfdu_y * dfdv_x;
    if (Math.abs(det) < 1e-15) return null;

    u += ( dfdv_y * dx - dfdv_x * dy) / det;
    v += (-dfdu_y * dx + dfdu_x * dy) / det;
  }
  return [u, v];
}

/**
 * Project a geographic point to a pixel position in the canvas-rendered image.
 *
 * @param scale  The render scale used when rendering pdf.js (canvas px per PDF pt).
 * @returns      [px, py] in canvas pixels, or null if outside the registered area.
 */
export function geoToCanvasPx(
  lat: number,
  lng: number,
  meta: GeoPdfMeta,
  scale: number,
): { x: number; y: number; insideMap: boolean } | null {
  const uv = geoToUnitSquare(lat, lng, meta.corners);
  if (!uv) return null;
  const [u, v] = uv;
  const [bx1, by1, bx2, by2] = meta.bbox;
  const [, pageH] = meta.pageSize;
  // PDF y-axis is bottom-up; canvas y is top-down.
  const xPdf = bx1 + u * (bx2 - bx1);
  const yPdf = by1 + v * (by2 - by1);
  return {
    x: xPdf * scale,
    y: (pageH - yPdf) * scale,
    insideMap: u >= 0 && u <= 1 && v >= 0 && v <= 1,
  };
}

/**
 * Forward bilinear projection: (u, v) ∈ [0,1]² → geographic (lat, lng).
 * The four corners are reordered the same way as geoToUnitSquare for consistency.
 */
export function unitSquareToGeo(
  u: number,
  v: number,
  corners: GeoPdfMeta["corners"],
): [number, number] {
  const pick = (ut: number, vt: number) =>
    corners.reduce(
      (best, c) => {
        const d = Math.hypot(c.lpt[0] - ut, c.lpt[1] - vt);
        return d < best.d ? { d, c } : best;
      },
      { d: Infinity, c: corners[0] },
    ).c.geo;

  const p00 = pick(0, 0);
  const p01 = pick(0, 1);
  const p11 = pick(1, 1);
  const p10 = pick(1, 0);

  const a = (1 - u) * (1 - v);
  const b = (1 - u) * v;
  const c = u * v;
  const d = u * (1 - v);
  return [
    a * p00[0] + b * p01[0] + c * p11[0] + d * p10[0],
    a * p00[1] + b * p01[1] + c * p11[1] + d * p10[1],
  ];
}

/**
 * Inverse of geoToCanvasPx: turn a canvas-pixel position back into geographic
 * coordinates. Returns null when the click landed clearly outside the map's
 * registered area (we allow a 10% margin to be forgiving on edge taps).
 */
export function canvasPxToGeo(
  x: number,
  y: number,
  meta: GeoPdfMeta,
  scale: number,
): { lat: number; lng: number } | null {
  const xPdf = x / scale;
  const yPdfFromTop = y / scale;
  const [, pageH] = meta.pageSize;
  const yPdf = pageH - yPdfFromTop;
  const [bx1, by1, bx2, by2] = meta.bbox;
  const u = (xPdf - bx1) / (bx2 - bx1);
  const v = (yPdf - by1) / (by2 - by1);
  if (u < -0.1 || u > 1.1 || v < -0.1 || v > 1.1) return null;
  const [lat, lng] = unitSquareToGeo(u, v, meta.corners);
  return { lat, lng };
}
