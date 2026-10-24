/** @typedef {'original' | 'square' | 'stack'} CanvasMode */
/** @typedef {'overall' | 'width' | 'height'} BorderBasis */

/**
 * Original mode keeps the existing percentage basis. Square frames and the
 * stack reference measure their border against the photo's long side.
 * @param {number} width
 * @param {number} height
 * @param {number} percent
 * @param {BorderBasis} basis
 * @param {CanvasMode} mode
 */
function borderPixels(width, height, percent, basis, mode) {
  const base = mode !== 'original'
    ? Math.max(width, height)
    : basis === 'width' ? width : basis === 'height' ? height : Math.min(width, height);
  return percent <= 0 ? 0 : Math.max(1, Math.round(base * percent / 100));
}

/**
 * Prefer the tallest portrait, regardless of upload order. With landscapes
 * only, use the tallest available aspect ratio; a new portrait updates it.
 * @param {{ width: number, height: number }[]} sizes
 */
export function stackReferenceIndex(sizes) {
  return sizes.reduce((best, size, index) =>
    best < 0 || size.width / size.height < sizes[best].width / sizes[best].height ? index : best, -1);
}

/**
 * Match the reference photo INCLUDING its even border. Preserving the bare
 * photo ratio would add letterboxing to the reference portrait itself.
 * @param {{ width: number, height: number, percent: number }[]} sizes
 */
export function stackCanvas(sizes) {
  const reference = sizes[stackReferenceIndex(sizes)];
  if (!reference) return { width: 1, height: 1 };
  const border = borderPixels(reference.width, reference.height, reference.percent, 'overall', 'stack');
  const framedWidth = reference.width + border * 2;
  const framedHeight = reference.height + border * 2;
  const longest = Math.max(...sizes.map(({ width, height, percent }) =>
    Math.max(width, height) + 2 * borderPixels(width, height, percent, 'overall', 'stack')));
  const scale = longest / Math.max(framedWidth, framedHeight);
  return {
    width: Math.max(1, Math.round(framedWidth * scale)),
    height: Math.max(1, Math.round(framedHeight * scale))
  };
}

/**
 * Shared geometry for previews, sampling, thumbnails, and downloaded images.
 * Padding centers the complete photo; it never crops or stretches it.
 * @param {number} width
 * @param {number} height
 * @param {number} percent
 * @param {BorderBasis} basis
 * @param {CanvasMode} mode
 * @param {{ width: number, height: number } | null} [stack]
 */
export function frameGeometry(width, height, percent, basis, mode, stack = null) {
  const border = borderPixels(width, height, percent, basis, mode);
  let canvasWidth = width + border * 2;
  let canvasHeight = height + border * 2;
  let scale = 1;
  if (mode === 'square') {
    canvasWidth = canvasHeight = Math.max(canvasWidth, canvasHeight);
  } else if (mode === 'stack' && stack) {
    canvasWidth = stack.width;
    canvasHeight = stack.height;
    // Use one border inset in output pixels on BOTH axes, then contain the
    // image inside it. Shared settings give landscapes the same side borders
    // as portraits rather than shrinking each photo's border independently.
    const inset = Math.round(Math.max(canvasWidth, canvasHeight) * percent / (100 + 2 * percent));
    scale = Math.min((canvasWidth - inset * 2) / width, (canvasHeight - inset * 2) / height);
  }
  const imageWidth = width * scale;
  const imageHeight = height * scale;
  return {
    width: canvasWidth,
    height: canvasHeight,
    x: (canvasWidth - imageWidth) / 2,
    y: (canvasHeight - imageHeight) / 2,
    imageWidth,
    imageHeight
  };
}
