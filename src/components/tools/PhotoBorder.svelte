<script lang="ts">
  import { onDestroy } from 'svelte';
  import { zipStore } from '../../lib/zipStore';
  import { frameGeometry, stackCanvas, stackReferenceIndex } from '../../lib/frameGeometry.js';

  const MIN_BORDER_PERCENT = 0;
  const MAX_BORDER_PERCENT = 30;
  const BORDER_PERCENT_STEP = 0.1;
  const BORDER_PERCENT_DECIMALS = 2;
  const MAX_PHOTOS = 20;
  const DIAL_DEG_MIN = -135;
  const DIAL_DEG_MAX = 135;

  type BorderMode = 'shared' | 'individual';
  type BorderBasis = 'overall' | 'width' | 'height';
  type CanvasMode = 'original' | 'square' | 'stack';

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
  let canvasMode = $state<CanvasMode>('original');
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
  let uploading = $state(false);
  let exportNotice = $state('');
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

  const photoSizes = $derived(photos.map((photo) => ({
    width: photo.image.naturalWidth,
    height: photo.image.naturalHeight,
    percent: settingsFor(photo).borderPercent
  })));
  const stackReference = $derived(photos[stackReferenceIndex(photoSizes)] ?? null);
  const stackSize = $derived(stackReference
    ? stackCanvas(photoSizes)
    : null);
  const activeGeometry = $derived(activePhoto ? geometryFor(activePhoto) : null);
  const percentBasis = $derived(canvasMode === 'original' ? borderBasisText(borderBasis) : canvasMode === 'stack' ? 'the reference photo’s longer side' : 'the longer image side');

  onDestroy(() => {
    for (const photo of photos) URL.revokeObjectURL(photo.src);
  });

  const dialAngle = $derived(
    DIAL_DEG_MIN +
      ((currentBorderPercent - MIN_BORDER_PERCENT) / (MAX_BORDER_PERCENT - MIN_BORDER_PERCENT)) *
        (DIAL_DEG_MAX - DIAL_DEG_MIN)
  );

  $effect(() => {
    eyeDropperSupported = typeof window !== 'undefined' && 'EyeDropper' in window;
  });

  $effect(() => {
    if (!previewCanvas || !activePhoto?.image.complete || !activeGeometry) return;
    drawPreview(previewCanvas, activePhoto.image, activeGeometry, currentBorderColor);
  });

  $effect(() => {
    if (activePhoto) prepareSampleCanvas();
  });

  function geometryFor(photo: Photo) {
    return frameGeometry(photo.image.naturalWidth, photo.image.naturalHeight,
      settingsFor(photo).borderPercent, borderBasis, canvasMode, stackSize);
  }

  function drawPreview(canvas: HTMLCanvasElement, img: HTMLImageElement,
    geometry: ReturnType<typeof frameGeometry>, color: string) {
    const scale = Math.min(1, 560 / Math.max(geometry.width, geometry.height));
    canvas.width = Math.max(1, Math.round(geometry.width * scale));
    canvas.height = Math.max(1, Math.round(geometry.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / geometry.width;
    const scaleY = canvas.height / geometry.height;
    ctx.drawImage(img, geometry.x * scaleX, geometry.y * scaleY,
      geometry.imageWidth * scaleX, geometry.imageHeight * scaleY);
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

  function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function addFiles(fileList: FileList | File[] | undefined) {
    if (!fileList || uploading || downloading) return;

    const images = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) {
      uploadNotice = 'Choose image files to add to your stack.';
      return;
    }

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

    uploading = true;
    const loaded: Photo[] = [];
    let failed = 0;
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
        failed += 1;
        URL.revokeObjectURL(src);
      }
    }

    uploading = false;
    if (failed) uploadNotice = [uploadNotice, `Could not read ${failed} image${failed === 1 ? '' : 's'}. Try JPEG, PNG, or WebP.`].filter(Boolean).join(' ');
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
    const geometry = activeGeometry;
    if (!geometry) return;
    const outputX = x / previewCanvas.width * geometry.width;
    const outputY = y / previewCanvas.height * geometry.height;
    if (outputX < geometry.x || outputY < geometry.y ||
      outputX >= geometry.x + geometry.imageWidth || outputY >= geometry.y + geometry.imageHeight) return;
    const imgX = (outputX - geometry.x) / geometry.imageWidth * activePhoto.image.naturalWidth;
    const imgY = (outputY - geometry.y) / geometry.imageHeight * activePhoto.image.naturalHeight;
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

  function framePhoto(photo: Photo, geometry = geometryFor(photo), color = settingsFor(photo).borderColor) {
    const out = document.createElement('canvas');
    out.width = geometry.width;
    out.height = geometry.height;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('Could not create image');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(photo.image, geometry.x, geometry.y, geometry.imageWidth, geometry.imageHeight);
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
    if (!activePhoto || downloading) return;
    downloading = true;
    exportNotice = '';
    const photo = activePhoto;
    try {
      const canvas = framePhoto(photo);
      const blob = await canvasToBlob(canvas);
      triggerDownload(blob, `${photo.fileName}-framed.png`);
    } catch {
      exportNotice = 'Could not export this photo. Try a smaller image.';
    } finally {
      downloading = false;
    }
  }

  async function downloadAll() {
    if (photos.length === 0 || downloading) return;

    downloading = true;
    exportNotice = '';
    try {
      const used = new Set<string>();
      const files: { name: string; data: Uint8Array }[] = [];

      const exports = photos.map((photo) => ({ photo, geometry: geometryFor(photo), color: settingsFor(photo).borderColor }));
      for (const { photo, geometry, color } of exports) {
        const canvas = framePhoto(photo, geometry, color);
        const blob = await canvasToBlob(canvas);
        const data = new Uint8Array(await blob.arrayBuffer());
        files.push({ name: uniqueName(`${photo.fileName}-framed.png`, used), data });
      }

      if (files.length > 0) triggerDownload(zipStore(files), 'framed-photos.zip');
    } catch {
      exportNotice = 'Could not export the stack. Try fewer or smaller images.';
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
    exportNotice = '';
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
      <span class="label" id="canvas-label">Canvas</span>
      <div class="canvas-options" role="group" aria-labelledby="canvas-label">
        {#each [{ value: 'original', label: 'Original', detail: 'Even border' }, { value: 'square', label: 'Square', detail: '1 : 1' }, { value: 'stack', label: 'Match stack', detail: 'One ratio for all' }] as option}
          <button type="button" class="canvas-option" class:active={canvasMode === option.value}
            aria-pressed={canvasMode === option.value} disabled={downloading}
            onclick={() => { canvasMode = option.value as CanvasMode; sampling = false; }}>
            <span>{option.label}</span><small>{option.detail}</small>
          </button>
        {/each}
      </div>
      <p class="canvas-note">
        {#if canvasMode === 'square'}
          A square canvas, with your whole photo centered. The percentage sets each left/right border for landscapes, or top/bottom border for portraits.
        {:else if canvasMode === 'stack'}
          Every photo shares a canvas based on the tallest portrait with its even border. Same border keeps the base border width identical across the stack; other photo shapes get extra padding to fit.
          {#if stackReference}
            <span class="reference-note">Matching {stackReference.fileName}{stackReference.image.naturalWidth >= stackReference.image.naturalHeight ? ' · Add a portrait to switch the whole stack to portrait.' : ''}</span>
          {/if}
        {:else}
          An even border around each photo, keeping its original dimensions inside the frame.
        {/if}
      </p>
    </div>

    <div class="control">
      <span class="label">Border {formatPercent(currentBorderPercent)}%</span>
      {#if canvasMode === 'original'}
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
      {:else}
        <span class="basis-note">Percentage of {canvasMode === 'stack' ? 'the reference photo’s longer side' : 'the longer image side'}, per edge</span>
      {/if}
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
        aria-valuetext="{formatPercent(currentBorderPercent)}% of {percentBasis}"
        role="slider"
        onpointerdown={onDialPointerDown}
        onpointermove={onDialPointerMove}
        onpointerup={onDialPointerUp}
        onpointercancel={onDialPointerUp}
        onkeydown={(e) => {
          const direction = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0;
          if (direction || e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            setCurrentBorderPercent(e.key === 'Home' ? MIN_BORDER_PERCENT : e.key === 'End' ? MAX_BORDER_PERCENT : snapBorderPercent(currentBorderPercent + direction * BORDER_PERCENT_STEP));
          }
        }}
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
          <input type="color" aria-label="Border color" value={currentBorderColor} oninput={onColorInput} />
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
          ? `Border is based on ${percentBasis}.`
          : `Same ${formatPercent(currentBorderPercent)}% of ${percentBasis} on all ${photos.length} photos.`
        : `Editing ${activePhoto?.fileName ?? 'selected photo'} at ${formatPercent(currentBorderPercent)}% of ${percentBasis}.`}
    </p>

    {#if exportNotice}
      <p class="upload-notice" role="alert">{exportNotice}</p>
    {/if}

    <div class="actions">
      <button type="button" class="btn primary" onclick={downloadCurrent} disabled={downloading || uploading}>
        {downloading ? 'Preparing…' : photos.length === 1 ? 'Download PNG' : 'Download this photo'}
      </button>
      {#if photos.length > 1}
        <button type="button" class="btn ghost" onclick={downloadAll} disabled={downloading || uploading}>
          Download ZIP ({photos.length})
        </button>
      {/if}
      <button type="button" class="btn ghost" onclick={() => addInput?.click()} disabled={uploading || downloading || photos.length >= MAX_PHOTOS}>
        {uploading ? 'Adding…' : 'Add photos'}
      </button>
      <button type="button" class="btn ghost" onclick={clearAll} disabled={uploading || downloading}>
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
    disabled={uploading || downloading}
    onchange={onFileInput}
  />

  {#if photos.length === 0}
    <label class="dropzone" ondragover={(e) => e.preventDefault()} ondrop={onDrop}>
      <input type="file" accept="image/*" multiple disabled={uploading} onchange={onFileInput} />
      <span class="dropzone-title">{uploading ? 'Adding photos…' : 'Drop photos or click to browse'}</span>
      <span class="dropzone-hint">Up to {MAX_PHOTOS} · processed on your device</span>
      <span class="dropzone-hint">Even borders, square frames, or one ratio for a mixed stack</span>
    </label>
  {:else}
    <div class="workspace" role="region" aria-label="Photo stack" ondragover={(e) => e.preventDefault()} ondrop={onDrop}>
      {@render controls()}

      <div class="filmstrip" role="list">
        {#each photos as photo (photo.id)}
          {@const geometry = geometryFor(photo)}
          <div class="thumb-wrap" role="listitem">
            <button
              type="button"
              class="thumb"
              class:active={photo.id === activePhoto?.id}
              style="--swatch: {settingsFor(photo).borderColor}; width: {72 * geometry.width / Math.max(geometry.width, geometry.height)}px; height: {72 * geometry.height / Math.max(geometry.width, geometry.height)}px"
              onclick={() => selectPhoto(photo.id)}
              aria-label="Select {photo.fileName}"
              aria-pressed={photo.id === activePhoto?.id}
            >
              <img src={photo.src} alt="" style="left: {geometry.x / geometry.width * 100}%; top: {geometry.y / geometry.height * 100}%; width: {geometry.imageWidth / geometry.width * 100}%; height: {geometry.imageHeight / geometry.height * 100}%" />
            </button>
            <button
              type="button"
              class="thumb-remove"
              onclick={() => removePhoto(photo.id)}
              disabled={downloading || uploading}
              aria-label="Remove {photo.fileName}"
            >
              ×
            </button>
          </div>
        {/each}
      </div>

      <div class="preview-wrap">
        {#if activePhoto && activeGeometry}
          <p class="preview-caption">{activePhoto.fileName} <span>{activeGeometry.width} × {activeGeometry.height} px{canvasMode === 'square' ? ' · 1:1' : canvasMode === 'stack' ? ' · shared canvas' : ''}</span></p>
        {/if}
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
  {#if uploadNotice}
    <p class="upload-notice" role="status">{uploadNotice}</p>
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
    text-align: center;
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
    gap: 0.8rem;
    align-items: center;
    min-height: 84px;
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
    position: relative;
    border: 0;
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
    position: absolute;
    object-fit: contain;
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

  .canvas-options {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: min(420px, 100%);
    border: 1px solid #ccc;
    background: #fff;
  }

  .canvas-option {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    align-items: center;
    padding: 0.8rem 0.5rem;
    border: 0;
    border-right: 1px solid #ccc;
    background: transparent;
    color: #666;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .canvas-option:last-child { border-right: 0; }
  .canvas-option.active { background: #333; color: #fff; }
  .canvas-option small { font-size: 0.7rem; opacity: 0.75; }
  .canvas-option:hover:not(.active) { background: #f5f5f5; }
  .canvas-option:focus-visible, button:focus-visible { outline: 2px solid #666; outline-offset: 3px; }
  .canvas-note { margin: 0; max-width: 420px; text-align: center; color: #777; font-size: 0.8rem; line-height: 1.6; }
  .reference-note { display: block; margin-top: 0.35rem; overflow-wrap: anywhere; }
  .basis-note { color: #888; font-size: 0.75rem; }
  .preview-caption { margin: 0 0 0.3rem; color: #555; font-size: 0.8rem; text-align: center; overflow-wrap: anywhere; }
  .preview-caption span { display: block; margin-top: 0.3rem; color: #888; font-size: 0.75rem; }

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
    margin: 0.75rem 0 0;
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
