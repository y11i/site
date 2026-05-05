<script lang="ts">
  import Gallery from './Gallery.svelte';
  import type { ImageMetadata } from 'astro';

  interface Props {
    images?: (string | (ImageMetadata & { __filename?: string; caption?: string }))[];
  }

  let { images = [] }: Props = $props();
</script>

<div class="photos-gallery">
  <div class="gallery-container">
    {#if images.length > 0}
      <Gallery images={images} />
    {:else}
      <p class="no-photos">No photos available</p>
    {/if}
  </div>
</div>

<style>
  .photos-gallery {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 1rem 2rem;
    min-height: 80vh;
  }

  .gallery-container {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .no-photos {
    text-align: center;
    color: #999;
    font-family: 'SUSE Mono', monospace;
    padding: 4rem 2rem;
  }
</style>
