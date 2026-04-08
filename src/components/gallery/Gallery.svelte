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

  // Responsive frame width based on screen size
  const BASE_FRAME_WIDTH_PX = 500;
  let screenWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1920);
  
  let frameWidthPx = $derived.by(() => {
    // On very large screens, scale up to maintain ~5 columns
    if (screenWidth / BASE_FRAME_WIDTH_PX > 5) {
      return screenWidth / 5;
    }
    // On mobile/small screens, scale down proportionally but maintain minimum
    if (screenWidth < BASE_FRAME_WIDTH_PX) {
      return Math.max(screenWidth * 0.9, 200); // Use 90% of screen width, min 200px
    }
    return BASE_FRAME_WIDTH_PX;
  });

  // Update screen width on resize
  $effect(() => {
    if (typeof window === 'undefined') return;
    
    function handleResize() {
      screenWidth = window.innerWidth;
    }
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });
  
  function getImageDimensions(image: string | ImageMetadata, index: number, frameWidth: number): { width: number; height: number } {
    
    if (typeof image === 'object' && image.width && image.height) {
      // Calculate precise dimensions in grid units, preserving exact aspect ratio
      const widthInUnits = image.width / frameWidth;
      const heightInUnits = image.height / frameWidth;
      
      // For vertical images (height > width), cap height at 1 unit and scale width proportionally
      if (heightInUnits > widthInUnits && heightInUnits > 1) {
        const aspectRatio = image.width / image.height;
        const width = aspectRatio; // Height is 1, so width = aspect ratio
        const height = 1;
        
        return { 
          width: Math.max(0.5, width), // Minimum 0.5 units
          height: height 
        };
      }
      
      // For landscape/square images, preserve exact aspect ratio
      // Don't force minimum size - let small images be small to maintain aspect ratio
      return { 
        width: widthInUnits, 
        height: heightInUnits 
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
  <BalancedMasonryGrid frameWidth={frameWidthPx} gap={10}>
    {#each images as image, index}
      {@const dims = getImageDimensions(image, index, frameWidthPx)}
      <Frame width={dims.width} height={dims.height}>
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
            loading="lazy"
            fetchpriority="low"
            decoding="async"
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

  .image-button:focus {
    outline: 2px solid rgba(0, 0, 0, 0.3);
    outline-offset: 1px;
  }
</style>
