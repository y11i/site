<script lang="ts">
  import { zipStore } from '../../lib/zipStore';

  const MIN_BORDER_PERCENT = 0;
  const MAX_BORDER_PERCENT = 30;
  const BORDER_PERCENT_STEP = 0.1;
  const BORDER_PERCENT_DECIMALS = 2;
  const MAX_PHOTOS = 20;
  const DIAL_DEG_MIN = -135;
  const DIAL_DEG_MAX = 135;

  type BorderMode = 'shared' | 'individual';
  type BorderBasis = 'overall' | 'width' | 'height';

  type Photo = {
    id: number;
    fileName: string;
    src: string;
    image: HTMLImageElement;
    borderPercent: number;
    borderColor: string;
  };

  let photos = $state<Photo[]>([]);
  let activeId = $state<number | null>(null);
  let borderMode = $state<BorderMode>('shared');
  let borderBasis = $state<BorderBasis>('width');
  let sharedBorderPercent = $state(5);
  let sharedBorderColor = $state('#ffffff');
  let individualDirty = $state(false);
  let sampling = $state(false);
  let eyeDropperSupported = $state(false);
  let dialDragging = $state(false);
  let dialEl = $state<HTMLButtonElement | null>(null);
  let previewCanvas = $state<HTMLCanvasElement | null>(null);
  let addInput = $state<HTMLInputElement | null>(null);
  let downloading = $state(false);
  let uploadNotice = $state('');
  let nextId = 1;
  let sampleCanvas: HTMLCanvasElement | null = null;

  const activePhoto = $derived(photos.find((photo) => photo.id === activeId) ?? photos[0] ?? null);
  const currentBorderPercent = $derived(
    borderMode === 'individual' ? activePhoto?.borderPercent ?? sharedBorderPercent : sharedBorderPercent
  );
  const currentBorderColor = $derived(
    borderMode === 'individual' ? activePhoto?.borderColor ?? sharedBorderColor : sharedBorderColor
  );

  const dialAngle = $derived(
    DIAL_DEG_MIN +
      ((currentBorderPercent - MIN_BORDER_PERCENT) / (MAX_BORDER_PERCENT - MIN_BORDER_PERCENT)) *
        (DIAL_DEG_MAX - DIAL_DEG_MIN)
  );

  $effect(() => {
    eyeDropperSupported = typeof window !== 'undefined' && 'EyeDropper' in window;
  });

  $effect(() => {
    void currentBorderPercent;
    void currentBorderColor;
    void borderBasis;
    void activePhoto;
    if (!previewCanvas || !activePhoto?.image.complete) return;
    prepareSampleCanvas();
    drawPreview();
  });

  function drawPreview() {
    const canvas = previewCanvas;
    const img = activePhoto?.image;
    if (!canvas || !img || !img.naturalWidth) return;

    const borderPx = borderPixelsFor(img, currentBorderPercent, borderBasis);
    const maxPreview = Math.min(560, typeof window !== 'undefined' ? window.innerWidth - 48 : 560);
    const paddedW = img.naturalWidth + borderPx * 2;
    const paddedH = img.naturalHeight + borderPx * 2;
    const scale = Math.min(1, maxPreview / Math.max(paddedW, paddedH));

    canvas.width = Math.round(paddedW * scale);
    canvas.height = Math.round(paddedH * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = currentBorderColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const inset = borderPx * scale;
    ctx.drawImage(img, inset, inset, canvas.width - inset * 2, canvas.height - inset * 2);
  }

  function normalizeBorderPercent(value: number) {
    if (!Number.isFinite(value)) return currentBorderPercent;
    const clamped = Math.min(MAX_BORDER_PERCENT, Math.max(MIN_BORDER_PERCENT, value));
    return Math.round(clamped * 10 ** BORDER_PERCENT_DECIMALS) / 10 ** BORDER_PERCENT_DECIMALS;
  }

  function snapBorderPercent(value: number) {
    return normalizeBorderPercent(Math.round(value / BORDER_PERCENT_STEP) * BORDER_PERCENT_STEP);
  }

  function formatPercent(value: number) {
    return normalizeBorderPercent(value)
      .toFixed(BORDER_PERCENT_DECIMALS)
      .replace(/\.?0+$/, '');
  }

  function borderPixelsFor(img: HTMLImageElement, percent: number, basis: BorderBasis) {
    if (percent <= 0) return 0;
    const base =
      basis === 'width'
        ? img.naturalWidth
        : basis === 'height'
          ? img.naturalHeight
          : Math.min(img.naturalWidth, img.naturalHeight);
    return Math.max(1, Math.round(base * (percent / 100)));
  }

  function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function addFiles(fileList: FileList | File[] | undefined) {
    if (!fileList) return;

    const images = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) return;

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      uploadNotice = `You can frame up to ${MAX_PHOTOS} photos at once.`;
      return;
    }

    const selected = images.slice(0, remaining);
    uploadNotice =
      images.length > remaining
        ? `Added ${selected.length}; ${MAX_PHOTOS} photos max.`
        : '';

    const loaded: Photo[] = [];
    for (const file of selected) {
      const src = URL.createObjectURL(file);
      try {
        const image = await loadImage(src);
        loaded.push({
          id: nextId++,
          fileName: file.name.replace(/\.[^.]+$/, '') || 'photo',
          src,
          image,
          borderPercent: currentBorderPercent,
          borderColor: currentBorderColor
        });
      } catch {
        URL.revokeObjectURL(src);
      }
    }

    if (loaded.length === 0) return;

    const wasEmpty = photos.length === 0;
    photos = [...photos, ...loaded];
    if (wasEmpty || activeId === null) activeId = loaded[0].id;
    sampling = false;
  }

  function onFileInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    void addFiles(input.files ?? undefined);
    input.value = '';
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    void addFiles(e.dataTransfer?.files ?? undefined);
  }

  function selectPhoto(id: number) {
    activeId = id;
    sampling = false;
  }

  function setBorderMode(next: BorderMode) {
    if (borderMode === next) return;
    sampling = false;
    dialDragging = false;

    if (next === 'individual' && !individualDirty) {
      photos = photos.map((photo) => ({
        ...photo,
        borderPercent: sharedBorderPercent,
        borderColor: sharedBorderColor
      }));
    }

    borderMode = next;
  }

  function setBorderBasis(next: BorderBasis) {
    borderBasis = next;
  }

  function setCurrentBorderPercent(value: number) {
    const next = normalizeBorderPercent(value);
    if (borderMode === 'individual' && activePhoto) {
      individualDirty = true;
      photos = photos.map((photo) => (photo.id === activePhoto.id ? { ...photo, borderPercent: next } : photo));
      return;
    }

    sharedBorderPercent = next;
  }

  function setCurrentBorderColor(value: string) {
    if (borderMode === 'individual' && activePhoto) {
      individualDirty = true;
      photos = photos.map((photo) => (photo.id === activePhoto.id ? { ...photo, borderColor: value } : photo));
      return;
    }

    sharedBorderColor = value;
  }

  function removePhoto(id: number) {
    const photo = photos.find((item) => item.id === id);
    if (photo) URL.revokeObjectURL(photo.src);

    const next = photos.filter((item) => item.id !== id);
    photos = next;

    if (activeId === id) {
      activeId = next[0]?.id ?? null;
      sampling = false;
    }

    if (next.length === 0) {
      sampleCanvas = null;
    }
  }

  function prepareSampleCanvas() {
    const img = activePhoto?.image;
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    sampleCanvas = canvas;
  }

  function borderFromAngle(deg: number) {
    const clamped = Math.min(DIAL_DEG_MAX, Math.max(DIAL_DEG_MIN, deg));
    const t = (clamped - DIAL_DEG_MIN) / (DIAL_DEG_MAX - DIAL_DEG_MIN);
    return snapBorderPercent(MIN_BORDER_PERCENT + t * (MAX_BORDER_PERCENT - MIN_BORDER_PERCENT));
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
    setCurrentBorderPercent(borderFromAngle(angleFromPointer(e.clientX, e.clientY)));
  }

  function onDialPointerMove(e: PointerEvent) {
    if (!dialDragging) return;
    setCurrentBorderPercent(borderFromAngle(angleFromPointer(e.clientX, e.clientY)));
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
    setCurrentBorderColor((e.currentTarget as HTMLInputElement).value);
  }

  async function useEyeDropper() {
    if (!('EyeDropper' in window)) return;
    try {
      // @ts-expect-error EyeDropper is not in all TS lib versions
      const dropper = new window.EyeDropper();
      const result = await dropper.open();
      setCurrentBorderColor(result.sRGBHex);
      sampling = false;
    } catch {
      // user cancelled
    }
  }

  function toggleSample() {
    sampling = !sampling;
  }

  function sampleFromPreview(e: MouseEvent) {
    if (!sampling || !previewCanvas || !activePhoto?.image || !sampleCanvas) return;

    const rect = previewCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * previewCanvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * previewCanvas.height;
    const borderPx = borderPixelsFor(activePhoto.image, currentBorderPercent, borderBasis);
    const scale = previewCanvas.width / (activePhoto.image.naturalWidth + borderPx * 2);
    const inset = borderPx * scale;

    if (x < inset || y < inset || x >= previewCanvas.width - inset || y >= previewCanvas.height - inset) {
      return;
    }

    const imgX = ((x - inset) / (previewCanvas.width - inset * 2)) * activePhoto.image.naturalWidth;
    const imgY = ((y - inset) / (previewCanvas.height - inset * 2)) * activePhoto.image.naturalHeight;
    const ctx = sampleCanvas.getContext('2d');
    if (!ctx) return;

    const pixel = ctx.getImageData(Math.floor(imgX), Math.floor(imgY), 1, 1).data;
    setCurrentBorderColor(rgbToHex(pixel[0], pixel[1], pixel[2]));
    sampling = false;
  }

  function rgbToHex(r: number, g: number, b: number) {
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function settingsFor(photo: Photo) {
    return borderMode === 'individual'
      ? { borderPercent: photo.borderPercent, borderColor: photo.borderColor, borderBasis }
      : { borderPercent: sharedBorderPercent, borderColor: sharedBorderColor, borderBasis };
  }

  function framePhoto(photo: Photo) {
    const { borderPercent, borderColor, borderBasis } = settingsFor(photo);
    const img = photo.image;
    const borderPx = borderPixelsFor(img, borderPercent, borderBasis);
    const out = document.createElement('canvas');
    out.width = img.naturalWidth + borderPx * 2;
    out.height = img.naturalHeight + borderPx * 2;
    const ctx = out.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = borderColor;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(img, borderPx, borderPx);
    return out;
  }

  function canvasToBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not export image'));
      }, 'image/png');
    });
  }

  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadCurrent() {
    if (!activePhoto) return;
    const canvas = framePhoto(activePhoto);
    if (!canvas) return;
    const blob = await canvasToBlob(canvas);
    triggerDownload(blob, `${activePhoto.fileName}-framed.png`);
  }

  async function downloadAll() {
    if (photos.length === 0) return;

    downloading = true;
    try {
      const used = new Set<string>();
      const files: { name: string; data: Uint8Array }[] = [];

      for (const photo of photos) {
        const canvas = framePhoto(photo);
        if (!canvas) continue;
        const blob = await canvasToBlob(canvas);
        const data = new Uint8Array(await blob.arrayBuffer());
        files.push({ name: uniqueName(`${photo.fileName}-framed.png`, used), data });
      }

      if (files.length > 0) triggerDownload(zipStore(files), 'framed-photos.zip');
    } finally {
      downloading = false;
    }
  }

  function uniqueName(name: string, used: Set<string>) {
    if (!used.has(name)) {
      used.add(name);
      return name;
    }

    const dot = name.lastIndexOf('.');
    const stem = dot === -1 ? name : name.slice(0, dot);
    const ext = dot === -1 ? '' : name.slice(dot);
    let i = 2;
    let next = `${stem}-${i}${ext}`;
    while (used.has(next)) {
      i += 1;
      next = `${stem}-${i}${ext}`;
    }
    used.add(next);
    return next;
  }

  function clearAll() {
    for (const photo of photos) URL.revokeObjectURL(photo.src);
    photos = [];
    activeId = null;
    sampleCanvas = null;
    sampling = false;
    uploadNotice = '';
  }

  function borderBasisText(basis: BorderBasis) {
    return basis === 'width' ? 'image width' : basis === 'height' ? 'image height' : 'the shorter image side';
  }
</script>

{#snippet controls()}
  <div class="controls">
    {#if photos.length > 1}
      <div class="mode-control" aria-label="Border editing mode">
        <button
          type="button"
          class="mode-btn"
          class:active={borderMode === 'shared'}
          onclick={() => setBorderMode('shared')}
        >
          Same border
        </button>
        <button
          type="button"
          class="mode-btn"
          class:active={borderMode === 'individual'}
          onclick={() => setBorderMode('individual')}
        >
          Per photo
        </button>
      </div>
    {/if}

    <div class="control">
      <span class="label">Border {formatPercent(currentBorderPercent)}%</span>
      <div class="basis-control" aria-label="Border percentage basis">
        <button
          type="button"
          class="mode-btn"
          class:active={borderBasis === 'overall'}
          onclick={() => setBorderBasis('overall')}
        >
          Overall
        </button>
        <button
          type="button"
          class="mode-btn"
          class:active={borderBasis === 'width'}
          onclick={() => setBorderBasis('width')}
        >
          Width
        </button>
        <button
          type="button"
          class="mode-btn"
          class:active={borderBasis === 'height'}
          onclick={() => setBorderBasis('height')}
        >
          Height
        </button>
      </div>
      <button
        type="button"
        class="dial"
        class:dragging={dialDragging}
        bind:this={dialEl}
        style="--angle: {dialAngle}deg"
        aria-label="Border size dial"
        aria-valuemin={MIN_BORDER_PERCENT}
        aria-valuemax={MAX_BORDER_PERCENT}
        aria-valuenow={currentBorderPercent}
        aria-valuetext="{formatPercent(currentBorderPercent)}% of {borderBasisText(borderBasis)}"
        role="slider"
        onpointerdown={onDialPointerDown}
        onpointermove={onDialPointerMove}
        onpointerup={onDialPointerUp}
        onpointercancel={onDialPointerUp}
      >
        <span class="dial-tick"></span>
        <span class="dial-value">{formatPercent(currentBorderPercent)}%</span>
      </button>
      <div class="percent-row">
        <input
          class="border-range"
          type="range"
          min={MIN_BORDER_PERCENT}
          max={MAX_BORDER_PERCENT}
          step={BORDER_PERCENT_STEP}
          value={currentBorderPercent}
          aria-label="Border size"
          oninput={(e) => {
            setCurrentBorderPercent((e.currentTarget as HTMLInputElement).valueAsNumber);
          }}
        />
        <label class="percent-input">
          <input
            type="number"
            min={MIN_BORDER_PERCENT}
            max={MAX_BORDER_PERCENT}
            step="any"
            value={formatPercent(currentBorderPercent)}
            aria-label="Border percentage"
            oninput={(e) => {
              setCurrentBorderPercent((e.currentTarget as HTMLInputElement).valueAsNumber);
            }}
          />
          <span>%</span>
        </label>
      </div>
    </div>

    <div class="control">
      <span class="label">Color</span>
      <div class="color-row">
        <label class="swatch" style="--swatch: {currentBorderColor}">
          <input type="color" value={currentBorderColor} oninput={onColorInput} />
        </label>
        <code class="hex">{currentBorderColor}</code>
        <button
          type="button"
          class="btn ghost"
          class:active={sampling}
          onclick={toggleSample}
          disabled={!activePhoto}
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

    <p class="shared-note">
      {borderMode === 'shared'
        ? photos.length === 1
          ? `Border is based on ${borderBasisText(borderBasis)}.`
          : `Same ${formatPercent(currentBorderPercent)}% of ${borderBasisText(borderBasis)} on all ${photos.length} photos.`
        : `Editing ${activePhoto?.fileName ?? 'selected photo'} at ${formatPercent(currentBorderPercent)}% of ${borderBasisText(borderBasis)}.`}
    </p>

    {#if uploadNotice}
      <p class="upload-notice">{uploadNotice}</p>
    {/if}

    <div class="actions">
      {#if photos.length > 1}
        <button type="button" class="btn primary" onclick={downloadAll} disabled={downloading}>
          {downloading ? 'Zipping…' : 'Download ZIP'}
        </button>
        <button type="button" class="btn ghost" onclick={downloadCurrent} disabled={downloading}>
          This one
        </button>
      {:else}
        <button type="button" class="btn primary" onclick={downloadAll} disabled={downloading}>
          {downloading ? 'Zipping…' : 'Download ZIP'}
        </button>
      {/if}
      <button type="button" class="btn ghost" onclick={() => addInput?.click()} disabled={photos.length >= MAX_PHOTOS}>
        Add photos
      </button>
      <button type="button" class="btn ghost" onclick={clearAll}>
        Clear
      </button>
    </div>
  </div>
{/snippet}

<div class="tool">
  <input
    class="hidden-input"
    type="file"
    accept="image/*"
    multiple
    bind:this={addInput}
    onchange={onFileInput}
  />

  {#if photos.length === 0}
    <label class="dropzone" ondragover={(e) => e.preventDefault()} ondrop={onDrop}>
      <input type="file" accept="image/*" multiple onchange={onFileInput} />
      <span class="dropzone-title">Drop photos</span>
      <span class="dropzone-hint">up to {MAX_PHOTOS} at once</span>
    </label>
  {:else}
    <div class="workspace">
      {@render controls()}

      <div class="filmstrip" role="list">
        {#each photos as photo (photo.id)}
          <div class="thumb-wrap" role="listitem">
            <button
              type="button"
              class="thumb"
              class:active={photo.id === activePhoto?.id}
              style="--swatch: {settingsFor(photo).borderColor}"
              onclick={() => selectPhoto(photo.id)}
              aria-label="Select {photo.fileName}"
              aria-pressed={photo.id === activePhoto?.id}
            >
              <img src={photo.src} alt="" />
            </button>
            {#if photos.length > 1}
              <button
                type="button"
                class="thumb-remove"
                onclick={() => removePhoto(photo.id)}
                aria-label="Remove {photo.fileName}"
              >
                ×
              </button>
            {/if}
          </div>
        {/each}
      </div>

      <div class="preview-wrap">
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
    </div>
  {/if}
</div>

<style>
  .tool {
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
  }

  .hidden-input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    overflow: hidden;
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

  .filmstrip {
    display: flex;
    gap: 0.6rem;
    overflow-x: auto;
    padding: 0.15rem 0.15rem 0.4rem;
  }

  .thumb-wrap {
    position: relative;
    flex: 0 0 auto;
  }

  .thumb {
    display: block;
    padding: 0;
    border: 3px solid var(--swatch);
    background: var(--swatch);
    cursor: pointer;
    line-height: 0;
    opacity: 0.55;
    transition: opacity 140ms ease, box-shadow 140ms ease;
  }

  .thumb.active,
  .thumb:hover {
    opacity: 1;
  }

  .thumb.active {
    box-shadow: 0 0 0 1px #333;
  }

  .thumb img {
    display: block;
    width: 64px;
    height: 64px;
    object-fit: cover;
  }

  .thumb-remove {
    position: absolute;
    top: -0.35rem;
    right: -0.35rem;
    width: 1.1rem;
    height: 1.1rem;
    padding: 0;
    border: 1px solid #ccc;
    border-radius: 50%;
    background: #fff;
    color: #333;
    font-size: 0.85rem;
    line-height: 1;
    cursor: pointer;
  }

  .preview-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
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

  .mode-control,
  .basis-control {
    display: inline-flex;
    align-self: center;
    border: 1px solid #ccc;
    background: #fff;
  }

  .mode-btn {
    appearance: none;
    border: 0;
    border-right: 1px solid #ccc;
    background: transparent;
    color: #666;
    font: inherit;
    font-size: 0.78rem;
    letter-spacing: 0.02em;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
  }

  .mode-btn:last-child {
    border-right: 0;
  }

  .mode-btn:hover,
  .mode-btn.active {
    background: #333;
    color: #fff;
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

  .percent-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    width: min(320px, 100%);
  }

  .border-range {
    flex: 1 1 180px;
    min-width: 0;
    width: min(220px, 100%);
    accent-color: #333;
  }

  .percent-input {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: #666;
    font-size: 0.82rem;
  }

  .percent-input input {
    width: 4.4rem;
    border: 1px solid #ccc;
    background: #fff;
    color: #333;
    font: inherit;
    padding: 0.42rem 0.45rem;
    text-align: right;
  }

  .percent-input input:focus {
    border-color: #333;
    outline: none;
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

  .shared-note {
    margin: 0;
    color: #999;
    font-size: 0.8rem;
    text-align: center;
  }

  .upload-notice {
    margin: -0.75rem 0 0;
    color: #666;
    font-size: 0.8rem;
    text-align: center;
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
