<script lang="ts">
  const MIN_BORDER = 0;
  const MAX_BORDER = 200;
  const DIAL_DEG_MIN = -135;
  const DIAL_DEG_MAX = 135;

  let imageSrc = $state<string | null>(null);
  let imageEl = $state<HTMLImageElement | null>(null);
  let fileName = $state('photo');
  let borderPx = $state(40);
  let borderColor = $state('#ffffff');
  let sampling = $state(false);
  let eyeDropperSupported = $state(false);
  let dialDragging = $state(false);
  let dialEl = $state<HTMLButtonElement | null>(null);
  let previewCanvas = $state<HTMLCanvasElement | null>(null);
  let sampleCanvas: HTMLCanvasElement | null = null;

  const dialAngle = $derived(
    DIAL_DEG_MIN + ((borderPx - MIN_BORDER) / (MAX_BORDER - MIN_BORDER)) * (DIAL_DEG_MAX - DIAL_DEG_MIN)
  );

  $effect(() => {
    eyeDropperSupported = typeof window !== 'undefined' && 'EyeDropper' in window;
  });

  $effect(() => {
    // Track border + color so the preview redraws when controls change.
    void borderPx;
    void borderColor;
    if (!imageSrc || !previewCanvas || !imageEl?.complete) return;
    drawPreview();
  });

  function drawPreview() {
    const canvas = previewCanvas;
    const img = imageEl;
    if (!canvas || !img || !img.naturalWidth) return;

    const maxPreview = Math.min(560, typeof window !== 'undefined' ? window.innerWidth - 48 : 560);
    const paddedW = img.naturalWidth + borderPx * 2;
    const paddedH = img.naturalHeight + borderPx * 2;
    const scale = Math.min(1, maxPreview / Math.max(paddedW, paddedH));

    canvas.width = Math.round(paddedW * scale);
    canvas.height = Math.round(paddedH * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = borderColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const inset = borderPx * scale;
    ctx.drawImage(
      img,
      inset,
      inset,
      canvas.width - inset * 2,
      canvas.height - inset * 2
    );
  }

  function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;

    if (imageSrc) URL.revokeObjectURL(imageSrc);

    const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
    fileName = name;
    imageSrc = URL.createObjectURL(file);
    sampleCanvas = null;
    sampling = false;
  }

  function onFileInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    handleFile(input.files?.[0]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    handleFile(e.dataTransfer?.files?.[0]);
  }

  function onImageLoad(e: Event) {
    imageEl = e.currentTarget as HTMLImageElement;
    prepareSampleCanvas();
    drawPreview();
  }

  function prepareSampleCanvas() {
    if (!imageEl) return;
    const canvas = document.createElement('canvas');
    canvas.width = imageEl.naturalWidth;
    canvas.height = imageEl.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(imageEl, 0, 0);
    sampleCanvas = canvas;
  }

  function borderFromAngle(deg: number) {
    const clamped = Math.min(DIAL_DEG_MAX, Math.max(DIAL_DEG_MIN, deg));
    const t = (clamped - DIAL_DEG_MIN) / (DIAL_DEG_MAX - DIAL_DEG_MIN);
    return Math.round(MIN_BORDER + t * (MAX_BORDER - MIN_BORDER));
  }

  function angleFromPointer(clientX: number, clientY: number) {
    if (!dialEl) return dialAngle;
    const rect = dialEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rad = Math.atan2(clientY - cy, clientX - cx);
    let deg = (rad * 180) / Math.PI + 90;
    if (deg > 180) deg -= 360;
    return deg;
  }

  function onDialPointerDown(e: PointerEvent) {
    e.preventDefault();
    dialDragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    borderPx = borderFromAngle(angleFromPointer(e.clientX, e.clientY));
  }

  function onDialPointerMove(e: PointerEvent) {
    if (!dialDragging) return;
    borderPx = borderFromAngle(angleFromPointer(e.clientX, e.clientY));
  }

  function onDialPointerUp(e: PointerEvent) {
    dialDragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
  }

  function onColorInput(e: Event) {
    borderColor = (e.currentTarget as HTMLInputElement).value;
  }

  async function useEyeDropper() {
    if (!('EyeDropper' in window)) return;
    try {
      // @ts-expect-error EyeDropper is not in all TS lib versions
      const dropper = new window.EyeDropper();
      const result = await dropper.open();
      borderColor = result.sRGBHex;
      sampling = false;
    } catch {
      // user cancelled
    }
  }

  function toggleSample() {
    sampling = !sampling;
  }

  function sampleFromPreview(e: MouseEvent) {
    if (!sampling || !previewCanvas || !imageEl || !sampleCanvas) return;

    const rect = previewCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * previewCanvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * previewCanvas.height;
    const scale = previewCanvas.width / (imageEl.naturalWidth + borderPx * 2);
    const inset = borderPx * scale;

    if (x < inset || y < inset || x >= previewCanvas.width - inset || y >= previewCanvas.height - inset) {
      return;
    }

    const imgX = ((x - inset) / (previewCanvas.width - inset * 2)) * imageEl.naturalWidth;
    const imgY = ((y - inset) / (previewCanvas.height - inset * 2)) * imageEl.naturalHeight;
    const ctx = sampleCanvas.getContext('2d');
    if (!ctx) return;

    const pixel = ctx.getImageData(Math.floor(imgX), Math.floor(imgY), 1, 1).data;
    borderColor = rgbToHex(pixel[0], pixel[1], pixel[2]);
    sampling = false;
  }

  function rgbToHex(r: number, g: number, b: number) {
    return (
      '#' +
      [r, g, b]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
    );
  }

  function download() {
    if (!imageEl?.naturalWidth) return;

    const out = document.createElement('canvas');
    out.width = imageEl.naturalWidth + borderPx * 2;
    out.height = imageEl.naturalHeight + borderPx * 2;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = borderColor;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(imageEl, borderPx, borderPx);

    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}-framed.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  function clearImage() {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    imageSrc = null;
    imageEl = null;
    sampleCanvas = null;
    sampling = false;
  }
</script>

<div class="tool">
  {#if !imageSrc}
    <label
      class="dropzone"
      ondragover={(e) => e.preventDefault()}
      ondrop={onDrop}
    >
      <input type="file" accept="image/*" onchange={onFileInput} />
      <span class="dropzone-title">Drop a photo</span>
      <span class="dropzone-hint">or click to upload</span>
    </label>
  {:else}
    <div class="workspace">
      <div class="preview-wrap">
        <!-- Hidden source image for canvas drawing -->
        <img
          class="source"
          src={imageSrc}
          alt=""
          onload={onImageLoad}
        />
        <canvas
          class="preview"
          class:sampling
          bind:this={previewCanvas}
          onclick={sampleFromPreview}
          aria-label="Framed photo preview"
        ></canvas>
        {#if sampling}
          <p class="sample-hint">Click the photo to grab a color</p>
        {/if}
      </div>

      <div class="controls">
        <div class="control">
          <span class="label">Border {borderPx}px</span>
          <button
            type="button"
            class="dial"
            class:dragging={dialDragging}
            bind:this={dialEl}
            style="--angle: {dialAngle}deg"
            aria-label="Border size dial"
            aria-valuemin={MIN_BORDER}
            aria-valuemax={MAX_BORDER}
            aria-valuenow={borderPx}
            role="slider"
            onpointerdown={onDialPointerDown}
            onpointermove={onDialPointerMove}
            onpointerup={onDialPointerUp}
            onpointercancel={onDialPointerUp}
          >
            <span class="dial-tick"></span>
            <span class="dial-value">{borderPx}</span>
          </button>
          <input
            class="border-range"
            type="range"
            min={MIN_BORDER}
            max={MAX_BORDER}
            value={borderPx}
            aria-label="Border size"
            oninput={(e) => {
              borderPx = Number((e.currentTarget as HTMLInputElement).value);
            }}
          />
        </div>

        <div class="control">
          <span class="label">Color</span>
          <div class="color-row">
            <label class="swatch" style="--swatch: {borderColor}">
              <input type="color" value={borderColor} oninput={onColorInput} />
            </label>
            <code class="hex">{borderColor}</code>
            <button
              type="button"
              class="btn ghost"
              class:active={sampling}
              onclick={toggleSample}
              disabled={!imageEl}
            >
              From photo
            </button>
            {#if eyeDropperSupported}
              <button type="button" class="btn ghost" onclick={useEyeDropper}>
                Eyedropper
              </button>
            {/if}
          </div>
        </div>

        <div class="actions">
          <button type="button" class="btn primary" onclick={download}>
            Download
          </button>
          <button type="button" class="btn ghost" onclick={clearImage}>
            New photo
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .tool {
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
  }

  .dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 280px;
    padding: 2rem;
    border: 1px dashed #ccc;
    background: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease;
  }

  .dropzone:hover {
    border-color: #999;
    background: rgba(255, 255, 255, 0.8);
  }

  .dropzone input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    overflow: hidden;
  }

  .dropzone-title {
    color: #333;
    font-size: 1rem;
    letter-spacing: 0.02em;
  }

  .dropzone-hint {
    color: #999;
    font-size: 0.85rem;
  }

  .workspace {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .preview-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
  }

  .source {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }

  .preview {
    display: block;
    max-width: 100%;
    height: auto;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.06),
      0 8px 24px rgba(0, 0, 0, 0.08);
  }

  .preview.sampling {
    cursor: crosshair;
  }

  .sample-hint {
    margin: 0;
    color: #666;
    font-size: 0.8rem;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .control {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .label {
    color: #666;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .dial {
    position: relative;
    width: 96px;
    height: 96px;
    border: 1px solid #ccc;
    border-radius: 50%;
    background:
      radial-gradient(circle at 50% 45%, #fff 0%, #f3f3f3 70%, #e8e8e8 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.9),
      0 2px 8px rgba(0, 0, 0, 0.06);
    cursor: grab;
    touch-action: none;
    user-select: none;
    padding: 0;
    color: #333;
  }

  .dial:active,
  .dial.dragging {
    cursor: grabbing;
  }

  .dial-tick {
    position: absolute;
    top: 10px;
    left: 50%;
    width: 3px;
    height: 14px;
    margin-left: -1.5px;
    border-radius: 1px;
    background: #333;
    transform-origin: 50% 38px;
    transform: rotate(var(--angle));
  }

  .dial-value {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 0.95rem;
    pointer-events: none;
  }

  .border-range {
    width: min(220px, 100%);
    accent-color: #333;
  }

  .color-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
  }

  .swatch {
    position: relative;
    width: 36px;
    height: 36px;
    border: 1px solid #ccc;
    background: var(--swatch);
    cursor: pointer;
    overflow: hidden;
  }

  .swatch input {
    position: absolute;
    inset: -4px;
    width: calc(100% + 8px);
    height: calc(100% + 8px);
    border: none;
    padding: 0;
    cursor: pointer;
    opacity: 0;
  }

  .hex {
    min-width: 5.5rem;
    color: #333;
    font-size: 0.85rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem;
    padding-top: 0.25rem;
  }

  .btn {
    appearance: none;
    border: 1px solid #ccc;
    background: #fff;
    color: #333;
    font: inherit;
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    padding: 0.55rem 1rem;
    cursor: pointer;
    transition: border-color 140ms ease, color 140ms ease, background 140ms ease;
  }

  .btn:hover:not(:disabled) {
    border-color: #999;
    color: #000;
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn.primary {
    background: #333;
    border-color: #333;
    color: #fff;
  }

  .btn.primary:hover:not(:disabled) {
    background: #000;
    border-color: #000;
    color: #fff;
  }

  .btn.ghost.active {
    border-color: #333;
    background: #f0f0f0;
  }
</style>
