<script lang="ts">
  import type { ImageMetadata } from 'astro';
  import Lightbox from './Lightbox.svelte';
  import {
    FRAME_PAD_BOTTOM,
    FRAME_PAD_TOP,
    FRAME_PAD_X,
    placePhotos,
    type PhotoMetrics,
  } from './placePhotos';

  type GalleryImage = string | (ImageMetadata & { __filename?: string; caption?: string });

  interface Props {
    images?: GalleryImage[];
  }

  let { images = [] }: Props = $props();

  let canvasEl = $state<HTMLDivElement | undefined>(undefined);
  let canvasWidth = $state(0);
  let focusedImage = $state<GalleryImage | null>(null);
  let focusedCaption = $state<string | undefined>(undefined);

  function getImageSrc(image: GalleryImage | any): string {
    if (typeof image === 'string') {
      return image;
    }
    if (typeof image === 'object' && image !== null) {
      return image.src || image;
    }
    return String(image);
  }

  function getImageWidth(image: GalleryImage | any): number | undefined {
    if (typeof image === 'object' && image !== null && typeof image.width === 'number') {
      return image.width;
    }
    return undefined;
  }

  function getImageHeight(image: GalleryImage | any): number | undefined {
    if (typeof image === 'object' && image !== null && typeof image.height === 'number') {
      return image.height;
    }
    return undefined;
  }

  function getFileName(image: GalleryImage | any): string {
    if (typeof image === 'object' && image !== null && image.__filename) {
      return image.__filename;
    }
    const src = getImageSrc(image);
    const parts = src.split('/');
    const filename = parts[parts.length - 1];
    return filename.split('?')[0];
  }

  function getCaption(image: GalleryImage): string | undefined {
    if (typeof image === 'object' && image !== null && 'caption' in image) {
      return image.caption;
    }
    return undefined;
  }

  function getAspectRatio(image: GalleryImage): number {
    const width = getImageWidth(image);
    const height = getImageHeight(image);
    if (!width || !height) return 3 / 2;
    return width / height;
  }

  function handleImageClick(image: GalleryImage) {
    focusedImage = image;
    focusedCaption = getCaption(image);
  }

  function closeLightbox() {
    focusedImage = null;
    focusedCaption = undefined;
  }

  const photoMetrics = $derived<PhotoMetrics[]>(
    images.map((image) => ({
      id: getFileName(image),
      aspectRatio: getAspectRatio(image),
    }))
  );

  const layout = $derived(placePhotos(photoMetrics, canvasWidth));
  const altText = 'Photo';

  $effect(() => {
    const el = canvasEl;
    if (!el) return;

    const updateWidth = () => {
      canvasWidth = el.clientWidth;
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);

    return () => observer.disconnect();
  });
</script>

{#if images.length > 0}
  <div
    class="scratch-canvas"
    bind:this={canvasEl}
    style:height={layout.height > 0 ? `${layout.height}px` : undefined}
    style:--frame-pad-x="{FRAME_PAD_X}px"
    style:--frame-pad-top="{FRAME_PAD_TOP}px"
    style:--frame-pad-bottom="{FRAME_PAD_BOTTOM}px"
  >
    {#each images as image, index}
      {@const placement = layout.placements[index]}
      {#if placement}
        <div
          class="photo-pin"
          data-motion="media"
          data-motion-repeat="false"
          style="
            left: {placement.x}px;
            top: {placement.y}px;
            width: {placement.width}px;
            z-index: {placement.zIndex};
            --motion-delay: {Math.min(index * 28, 420)}ms;
            --motion-y: 16px;
            --motion-scale: 1;
            --motion-blur: 0px;
          "
        >
          <button
            type="button"
            class="photo-frame"
            onclick={() => handleImageClick(image)}
            aria-label={`View ${altText} ${index + 1}`}
          >
            <img
              src={getImageSrc(image)}
              alt={`${altText} ${index + 1}`}
              width={getImageWidth(image)}
              height={getImageHeight(image)}
              loading="lazy"
              fetchpriority="low"
              decoding="async"
              class="photo-image"
              style:aspect-ratio={getAspectRatio(image)}
            />
          </button>
        </div>
      {/if}
    {/each}
  </div>
{/if}

<Lightbox
  image={focusedImage}
  caption={focusedCaption}
  isOpen={focusedImage !== null}
  onClose={closeLightbox}
/>

<style>
  .scratch-canvas {
    position: relative;
    width: 100%;
    min-height: 70vh;
  }

  .photo-pin {
    position: absolute;
    top: 0;
    left: 0;
  }

  .photo-frame {
    appearance: none;
    box-sizing: border-box;
    width: 100%;
    padding: var(--frame-pad-top) var(--frame-pad-x) var(--frame-pad-bottom);
    margin: 0;
    border: none;
    background: #fff;
    cursor: pointer;
    display: block;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.08),
      0 5px 14px rgba(0, 0, 0, 0.12);
  }

  .photo-frame:focus {
    outline: 2px solid rgba(0, 0, 0, 0.28);
    outline-offset: 3px;
  }

  .photo-image {
    width: 100%;
    height: auto;
    display: block;
  }

  @media (max-width: 580px) {
    .scratch-canvas {
      min-height: 50vh;
    }
  }
</style>
