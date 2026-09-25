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
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 0.25rem 0 3rem;
    min-height: 80vh;
  }

  .gallery-container {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    display: flex;
    justify-content: center;
    overflow-x: clip;
  }

  .no-photos {
    text-align: center;
    color: #999;
    font-family: 'SUSE Mono', monospace;
    padding: 4rem 2rem;
  }
</style>
