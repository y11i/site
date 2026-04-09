<script lang="ts">
  import Gallery from './Gallery.svelte';
  import type { ImageMetadata } from 'astro';
  import bnwCaptions from '../../assets/content/gallery/bnw.json';
  import colorCaptions from '../../assets/content/gallery/color.json';

  interface Props {
    bnwImages?: (string | ImageMetadata)[];
    colorImages?: (string | ImageMetadata)[];
  }

  let { bnwImages = [], colorImages = [] }: Props = $props();

  let isColor = $state(true);

  function toggleMode() {
    isColor = !isColor;
  }

  let currentImages = $derived(isColor ? colorImages : bnwImages);
  let currentType = $derived<'bnw' | 'color'>(isColor ? 'color' : 'bnw');
  let currentCaptions = $derived(isColor
    ? (colorCaptions as Record<string, string>)
    : (bnwCaptions as Record<string, string>));
</script>

<div class="photos-gallery">
  <div class="toggle-container" data-motion="text" data-motion-repeat="false">
    <button
      type="button"
      class="toggle-switch"
      class:active={isColor}
      onclick={toggleMode}
      aria-label="Toggle between black and white and color photos"
      aria-pressed={isColor}
    >
      <span class="toggle-label" class:active={isColor}>Color</span>
      <span class="toggle-slider"></span>
      <span class="toggle-label" class:active={!isColor}>Black & White</span>
    </button>
  </div>

  <div class="gallery-container">
    {#if currentImages.length > 0}
      {#key currentType}
        <Gallery images={currentImages} type={currentType} captions={currentCaptions} />
      {/key}
    {:else}
      <p class="no-photos">No photos available</p>
    {/if}
  </div>
</div>

<style>
  .photos-gallery {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 0.5rem 1rem 2rem 1rem;
    min-height: 80vh;
  }

  .toggle-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0.5rem 0;
  }

  .toggle-switch {
    position: relative;
    display: flex;
    align-items: center;
    width: 220px;
    height: 32px;
    padding: 3px;
    background: rgba(245, 245, 245, 0.5);
    border: 1px solid rgba(224, 224, 224, 0.5);
    border-radius: 16px;
    cursor: pointer;
    transition: background 0.3s ease;
    font-family: 'SUSE Mono', monospace;
    font-size: 0.7rem;
  }

  .toggle-switch:hover {
    background: rgba(240, 240, 240, 0.6);
  }

  .toggle-label {
    position: relative;
    z-index: 2;
    flex: 1;
    text-align: center;
    color: #666;
    transition: color 0.3s ease;
    user-select: none;
    font-weight: 500;
  }

  .toggle-label.active {
    color: #000;
    font-weight: 600;
  }

  .toggle-slider {
    position: absolute;
    left: calc(50% + 0px);
    top: 3px;
    width: calc(50% - 3px);
    height: calc(100% - 6px);
    background: rgba(208, 208, 208, 0.6);
    border-radius: 13px;
    transition: transform 0.3s ease;
    z-index: 1;
  }

  .toggle-switch.active .toggle-slider {
    transform: translateX(-100%);
    background: rgba(208, 208, 208, 0.6);
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

  @media (max-width: 640px) {
    .toggle-switch {
      width: 200px;
      height: 28px;
      font-size: 0.65rem;
    }
  }
</style>
