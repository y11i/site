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
 * Scratch-pad placement: start bunched toward the top, then loosen as the
 * pad fills so the bottom has more air. Frames stay upright and never overlap.
 * The finished group is centered so side margins stay even.
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
  const lastIndex = Math.max(photos.length - 1, 1);

  for (let index = 0; index < photos.length; index++) {
    const photo = photos[index];
    const rng = mulberry32(hashString(`${photo.id}:${index}`));
    const looseness = index / lastIndex;
    const scale = singleColumn ? 0.94 : 0.9 + rng() * 0.12;
    const portrait = photo.aspectRatio < 1;
    // Landscapes read smaller than portraits at the same width; give them a bump.
    const orientationScale = singleColumn ? 1 : portrait ? 0.94 : 1.23;
    const imgW = Math.min(
      targetWidth * scale * orientationScale,
      canvasWidth - pad * 2 - FRAME_PAD_X * 2
    );
    const imgH = imgW / photo.aspectRatio;
    const frameW = imgW + FRAME_PAD_X * 2;
    const frameH = imgH + FRAME_PAD_TOP + FRAME_PAD_BOTTOM;
    const gap = gapMin + looseness * (gapMax - gapMin) + rng() * 8;

    let x: number;
    let y: number;

    if (singleColumn) {
      x = (canvasWidth - frameW) / 2;
      y = stackY + rng() * (6 + looseness * 10);
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
        looseness,
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
  looseness: number;
}): { x: number; y: number } {
  const { frameW, frameH, canvasWidth, pad, gap, occupied, rng, looseness } = args;
  const minX = pad;
  const maxX = Math.max(pad, canvasWidth - pad - frameW);
  const step = 10;
  const maxBottom = occupied.reduce((max, rect) => Math.max(max, rect.y + rect.height), pad);
  const yLimit = maxBottom + frameH + gap + 40;

  if (occupied.length === 0) {
    // Start as the left print of a roughly centered pair so the top doesn't drift right.
    const neighborW = frameW + gap;
    const canSitBeside = minX + neighborW <= maxX;
    let x: number;
    if (canSitBeside) {
      const pairWidth = frameW * 2 + gap;
      const pairStart = (canvasWidth - pairWidth) / 2;
      x = clamp(pairStart + (rng() - 0.5) * 80, minX, maxX - neighborW);
    } else {
      x = (minX + maxX) / 2 + (rng() - 0.5) * 50;
    }
    return { x: clamp(x, minX, maxX), y: pad + rng() * 10 };
  }

  for (let y = pad; y <= yLimit; y += step) {
    const openXs: number[] = [];

    for (let x = minX; x <= maxX; x += step) {
      const candidate = { x, y, width: frameW, height: frameH };
      if (!occupied.some((rect) => overlaps(rect, candidate, gap))) {
        openXs.push(x);
      }
    }

    if (openXs.length === 0) continue;

    // Mild cluster early → seek space later, with enough noise to avoid tidy columns.
    let chosenX = openXs[0];
    let bestScore = Infinity;
    const packPull = (1 - looseness) * 0.45;
    const spreadPull = looseness * 0.7;

    for (const x of openXs) {
      const center = x + frameW / 2;
      let crowding = 0;
      let columnPenalty = 0;

      for (const rect of occupied) {
        const rectCenter = rect.x + rect.width / 2;
        const dist = Math.abs(rectCenter - center);
        if (dist < canvasWidth * 0.45) {
          crowding += rect.width / (1 + dist * 0.015);
        }
        // Prefer a little horizontal drift instead of stacking in one lane.
        if (dist < frameW * 0.3) {
          columnPenalty += (1 - dist / (frameW * 0.3)) * 140;
        }
      }

      const score =
        crowding * (spreadPull - packPull) +
        columnPenalty * (1 - looseness * 0.35) +
        rng() * (60 + looseness * 50);
      if (score < bestScore) {
        bestScore = score;
        chosenX = x;
      }
    }

    // Try a few horizontal staggers so rows don't lock into clean columns.
    const nudgeY = rng() * (12 + looseness * 20);
    const staggers = [0, 1, -1, 2, -2, 3, -3].map(
      (slot) => slot * (18 + rng() * 22) + (rng() - 0.5) * 12
    );

    for (const nudgeX of staggers) {
      const nudged = {
        x: clamp(chosenX + nudgeX, minX, maxX),
        y: y + nudgeY,
        width: frameW,
        height: frameH,
      };
      if (!occupied.some((rect) => overlaps(rect, nudged, gap))) {
        return { x: nudged.x, y: nudged.y };
      }
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

  // Center on the top of the pad so a wider bottom can't shove the opening sideways.
  const byY = [...placements].sort((a, b) => a.y - b.y);
  const focusCount = Math.max(2, Math.ceil(placements.length * 0.35));
  const focus = byY.slice(0, focusCount);

  let focusMin = Infinity;
  let focusMax = -Infinity;
  for (const placement of focus) {
    focusMin = Math.min(focusMin, placement.x);
    focusMax = Math.max(focusMax, placement.x + placement.width);
  }

  let dx = (canvasWidth - (focusMax - focusMin)) / 2 - focusMin;

  let allMin = Infinity;
  let allMax = -Infinity;
  for (const placement of placements) {
    allMin = Math.min(allMin, placement.x + dx);
    allMax = Math.max(allMax, placement.x + placement.width + dx);
  }
  if (allMin < pad) dx += pad - allMin;
  if (allMax > canvasWidth - pad) dx += canvasWidth - pad - allMax;

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
