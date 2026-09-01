export const FRAME_PAD_X = 11;
export const FRAME_PAD_TOP = 11;
export const FRAME_PAD_BOTTOM = 11;

export type PhotoMetrics = {
  id: string;
  aspectRatio: number;
};

export type PhotoPlacement = {
  x: number;
  y: number;
  width: number;
  zIndex: number;
};

export type ScratchLayout = {
  placements: PhotoPlacement[];
  height: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Scratch-pad placement: dense top-first packing that spreads across the
 * full width, then centers the finished group so side margins stay even.
 * Frames stay upright and never overlap.
 */
export function placePhotos(photos: PhotoMetrics[], canvasWidth: number): ScratchLayout {
  if (canvasWidth <= 0 || photos.length === 0) {
    return { placements: [], height: 0 };
  }

  const pad = Math.max(14, Math.round(canvasWidth * 0.018));
  const singleColumn = canvasWidth < 600;
  const gapMin = singleColumn ? 20 : 18;
  const gapMax = singleColumn ? 28 : 34;
  const targetWidth = singleColumn
    ? canvasWidth - pad * 2
    : clamp(canvasWidth * (canvasWidth < 980 ? 0.48 : canvasWidth < 1480 ? 0.34 : 0.28), 300, 480);

  const occupied: Rect[] = [];
  const placements: PhotoPlacement[] = [];
  let stackY = pad;

  for (let index = 0; index < photos.length; index++) {
    const photo = photos[index];
    const rng = mulberry32(hashString(`${photo.id}:${index}`));
    const scale = singleColumn ? 0.94 : 0.9 + rng() * 0.12;
    const portrait = photo.aspectRatio < 1;
    const imgW = Math.min(
      targetWidth * scale * (singleColumn || !portrait ? 1 : 0.94),
      canvasWidth - pad * 2 - FRAME_PAD_X * 2
    );
    const imgH = imgW / photo.aspectRatio;
    const frameW = imgW + FRAME_PAD_X * 2;
    const frameH = imgH + FRAME_PAD_TOP + FRAME_PAD_BOTTOM;
    const gap = gapMin + rng() * (gapMax - gapMin);

    let x: number;
    let y: number;

    if (singleColumn) {
      x = (canvasWidth - frameW) / 2;
      y = stackY + rng() * 6;
      stackY = y + frameH + gap;
    } else {
      const spot = findOpenSpot({
        frameW,
        frameH,
        canvasWidth,
        pad,
        gap,
        occupied,
        rng,
      });
      x = spot.x;
      y = spot.y;
    }

    occupied.push({ x, y, width: frameW, height: frameH });
    placements.push({
      x,
      y,
      width: frameW,
      zIndex: Math.floor(rng() * 18) + 1,
    });
  }

  if (!singleColumn) {
    centerHorizontally(placements, canvasWidth, pad);
  }

  let height = pad;
  for (let i = 0; i < placements.length; i++) {
    const imgH = (placements[i].width - FRAME_PAD_X * 2) / photos[i].aspectRatio;
    const frameH = imgH + FRAME_PAD_TOP + FRAME_PAD_BOTTOM;
    height = Math.max(height, placements[i].y + frameH);
  }

  return { placements, height: height + pad };
}

function findOpenSpot(args: {
  frameW: number;
  frameH: number;
  canvasWidth: number;
  pad: number;
  gap: number;
  occupied: Rect[];
  rng: () => number;
}): { x: number; y: number } {
  const { frameW, frameH, canvasWidth, pad, gap, occupied, rng } = args;
  const minX = pad;
  const maxX = Math.max(pad, canvasWidth - pad - frameW);
  const step = 10;
  const maxBottom = occupied.reduce((max, rect) => Math.max(max, rect.y + rect.height), pad);
  const yLimit = maxBottom + frameH + gap + 40;

  for (let y = pad; y <= yLimit; y += step) {
    const openXs: number[] = [];

    for (let x = minX; x <= maxX; x += step) {
      const candidate = { x, y, width: frameW, height: frameH };
      if (!occupied.some((rect) => overlaps(rect, candidate, gap))) {
        openXs.push(x);
      }
    }

    if (openXs.length === 0) continue;

    // Prefer the emptier side of the page so prints spread across the width.
    let chosenX = openXs[0];
    let bestScore = Infinity;

    for (const x of openXs) {
      const center = x + frameW / 2;
      let crowding = 0;

      for (const rect of occupied) {
        const rectCenter = rect.x + rect.width / 2;
        const dist = Math.abs(rectCenter - center);
        if (dist < canvasWidth * 0.4) {
          crowding += rect.width / (1 + dist * 0.015);
        }
      }

      const score = crowding + rng() * 40;
      if (score < bestScore) {
        bestScore = score;
        chosenX = x;
      }
    }

    const nudgeX = (rng() - 0.5) * 20;
    const nudgeY = rng() * 14;
    const nudged = {
      x: clamp(chosenX + nudgeX, minX, maxX),
      y: y + nudgeY,
      width: frameW,
      height: frameH,
    };

    if (!occupied.some((rect) => overlaps(rect, nudged, gap))) {
      return { x: nudged.x, y: nudged.y };
    }

    return { x: chosenX, y };
  }

  return {
    x: minX + rng() * (maxX - minX),
    y: maxBottom + gap,
  };
}

function centerHorizontally(
  placements: PhotoPlacement[],
  canvasWidth: number,
  pad: number
): void {
  if (placements.length === 0) return;

  let minX = Infinity;
  let maxX = -Infinity;

  for (const placement of placements) {
    minX = Math.min(minX, placement.x);
    maxX = Math.max(maxX, placement.x + placement.width);
  }

  const contentWidth = maxX - minX;
  let dx = (canvasWidth - contentWidth) / 2 - minX;

  if (minX + dx < pad) dx = pad - minX;
  if (maxX + dx > canvasWidth - pad) dx = canvasWidth - pad - maxX;

  for (const placement of placements) {
    placement.x += dx;
  }
}

function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed;

  return () => {
    t += 0x6d2b79f5;
    let n = Math.imul(t ^ (t >>> 15), t | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
