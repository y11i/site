<script lang="ts">
  import { BalancedMasonryGrid, Frame } from '@masonry-grid/svelte';
  import type { ImageMetadata } from 'astro';
  import Lightbox from './Lightbox.svelte';

  interface Props {
    images?: (string | ImageMetadata)[];
    type?: 'bnw' | 'color';
    captions?: Record<string, string>;
  }

  let { images = [], type = 'color', captions = {} }: Props = $props();

  // State for lightbox
  let focusedImage = $state<string | ImageMetadata | null>(null);
  let focusedCaption = $state<string | undefined>(undefined);

  // Helper function to get image source
  function getImageSrc(image: string | ImageMetadata | any): string {
    if (typeof image === 'string') {
      return image;
    }
    if (typeof image === 'object' && image !== null) {
      return image.src || image;
    }
    return String(image);
  }

  // Extract file name from image path
  function getFileName(image: string | ImageMetadata | any): string {
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
  function getCaption(image: string | ImageMetadata): string | undefined {
    const fileName = getFileName(image);
    return captions[fileName];
  }

  // Handle image click
  function handleImageClick(image: string | ImageMetadata) {
    focusedImage = image;
    focusedCaption = getCaption(image);
  }

  // Close lightbox
  function closeLightbox() {
    focusedImage = null;
    focusedCaption = undefined;
  }

  // Helper function to get image dimensions in grid units
  const FRAME_WIDTH_PX = 400;
  
  function getImageDimensions(image: string | ImageMetadata, index: number): { width: number; height: number } {
    if (typeof image === 'object' && image.width && image.height) {
      // For vertical images (height > width), cap height at frame width and scale width proportionally
      if (image.height > image.width) {
        // Set max height to FRAME_WIDTH_PX (1 grid unit)
        const maxHeightPx = FRAME_WIDTH_PX;
        // Calculate width proportionally based on aspect ratio
        const aspectRatio = image.width / image.height;
        const scaledWidthPx = maxHeightPx * aspectRatio;
        // Convert to grid units
        const width = Math.round(scaledWidthPx / FRAME_WIDTH_PX * 10) / 10; // Allow decimals for precision
        const height = 1; // 1 grid unit (FRAME_WIDTH_PX)
        
        return { 
          width: Math.max(0.5, width), // Minimum 0.5 units
          height: height 
        };
      }
      
      // For landscape/square images, use native dimensions
      const width = Math.round(image.width / FRAME_WIDTH_PX);
      const height = Math.round(image.height / FRAME_WIDTH_PX);
      // Ensure minimum size of 1 unit
      return { 
        width: Math.max(1, width), 
        height: Math.max(1, height) 
      };
    }
    // For string URLs, we can't get dimensions without loading the image
    // Use a default aspect ratio as fallback
    const defaultRatios = [4, 3, 5, 4, 3, 4, 5, 3];
    const ratio = defaultRatios[index % defaultRatios.length];
    return { width: 4, height: ratio };
  }

  let altText = $derived(type === 'bnw' ? 'Black and white photo' : 'Color photo');
</script>

{#if images.length > 0}
  <BalancedMasonryGrid frameWidth={FRAME_WIDTH_PX} gap={10}>
    {#each images as image, index}
      {@const dims = getImageDimensions(image, index)}
      <Frame width={dims.width} height={dims.height}>
        <button
          type="button"
          class="image-button"
          onclick={() => handleImageClick(image)}
          aria-label={`View ${altText} ${index + 1}`}
        >
          <img 
            src={getImageSrc(image)} 
            alt={`${altText} ${index + 1}`}
            loading="lazy"
            style="width: 100%; height: 100%; object-fit: cover; display: block;"
          />
        </button>
      </Frame>
    {/each}
  </BalancedMasonryGrid>
{/if}

<Lightbox 
  image={focusedImage} 
  caption={focusedCaption}
  isOpen={focusedImage !== null}
  onClose={closeLightbox}
/>

<style>
  .image-button {
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    border: none;
    background: none;
    cursor: pointer;
    display: block;
  }

  .image-button:hover {
    opacity: 0.95;
  }

  .image-button:focus {
    outline: 2px solid rgba(0, 0, 0, 0.3);
    outline-offset: 2px;
  }
</style>

