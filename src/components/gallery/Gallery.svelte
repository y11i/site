<script lang="ts">
  import type { ImageMetadata } from 'astro';
  import Lightbox from './Lightbox.svelte';

  type GalleryImage = string | (ImageMetadata & { __filename?: string; caption?: string });

  interface Props {
    images?: GalleryImage[];
  }

  let { images = [] }: Props = $props();

  // State for lightbox
  let focusedImage = $state<GalleryImage | null>(null);
  let focusedCaption = $state<string | undefined>(undefined);

  // Helper function to get image source
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

  function getImageRatio(image: GalleryImage | any): string | undefined {
    const width = getImageWidth(image);
    const height = getImageHeight(image);
    if (!width || !height) return undefined;
    return `${width} / ${height}`;
  }

  // Extract file name from image path
  function getFileName(image: GalleryImage | any): string {
    // First check if filename was attached during import
    if (typeof image === 'object' && image !== null && image.__filename) {
      return image.__filename;
    }
    // Otherwise extract from src path
    const src = getImageSrc(image);
    // Extract filename from path (handles both /path/to/file.jpg and full URLs)
    const parts = src.split('/');
    const filename = parts[parts.length - 1];
    // Remove query params if any
    return filename.split('?')[0];
  }

  // Get caption for an image
  function getCaption(image: GalleryImage): string | undefined {
    if (typeof image === 'object' && image !== null && 'caption' in image) {
      return image.caption;
    }
    return undefined;
  }

  // Handle image click
  function handleImageClick(image: GalleryImage) {
    focusedImage = image;
    focusedCaption = getCaption(image);
  }

  // Close lightbox
  function closeLightbox() {
    focusedImage = null;
    focusedCaption = undefined;
  }

  const altText = 'Photo';
</script>

{#if images.length > 0}
  <div class="gallery-grid">
    {#each images as image, index}
      <div class="gallery-item" style:aspect-ratio={getImageRatio(image)}>
        <button
          type="button"
          class="image-button"
          onclick={() => handleImageClick(image)}
          aria-label={`View ${altText} ${index + 1}`}
          data-motion="image"
          data-motion-repeat="false"
          style="--motion-delay: 0ms; --motion-transform-hidden: none; --motion-transform-visible: none;"
        >
          <img
            src={getImageSrc(image)}
            alt={`${altText} ${index + 1}`}
            width={getImageWidth(image)}
            height={getImageHeight(image)}
            loading="lazy"
            fetchpriority="low"
            decoding="async"
            class="gallery-image"
          />
        </button>
      </div>
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
  .gallery-grid {
    width: min(100%, 1900px);
    column-width: 450px;
    column-gap: 10px;
  }

  .gallery-item {
    width: 100%;
    break-inside: avoid;
    margin: 0 0 10px;
    overflow: hidden;
  }

  .image-button {
    width: 100%;
    padding: 0;
    margin: 0;
    border: none;
    background: none;
    cursor: pointer;
    display: block;
    height: 100%;
  }

  .gallery-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  .image-button:focus {
    outline: 2px solid rgba(0, 0, 0, 0.3);
    outline-offset: 1px;
  }

  @media (max-width: 900px) {
    .gallery-grid {
      column-width: 340px;
    }
  }

  @media (max-width: 580px) {
    .gallery-grid {
      width: 100%;
    }
  }
</style>
