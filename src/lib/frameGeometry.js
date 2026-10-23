/** @typedef {'original' | 'square' | 'stack'} CanvasMode */
/** @typedef {'overall' | 'width' | 'height'} BorderBasis */

/**
 * Original mode keeps the existing percentage basis. Fixed canvases measure
 * each minimum border against the photo's long side before fitting it.
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
 * One canvas size for every export, including when borders differ per photo.
 * @param {{ width: number, height: number, percent: number }[]} sizes
 * @param {number} ratio
 */
export function stackCanvas(sizes, ratio) {
  const longest = Math.max(1, ...sizes.map(({ width, height, percent }) =>
    Math.max(width, height) + 2 * borderPixels(width, height, percent, 'overall', 'stack')));
  return ratio >= 1
    ? { width: longest, height: Math.max(1, Math.round(longest / ratio)) }
    : { width: Math.max(1, Math.round(longest * ratio)), height: longest };
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
    scale = Math.min(stack.width / canvasWidth, stack.height / canvasHeight);
    canvasWidth = stack.width;
    canvasHeight = stack.height;
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
