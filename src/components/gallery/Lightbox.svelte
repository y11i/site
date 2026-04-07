<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import type { ImageMetadata } from 'astro';

  interface Props {
    image: string | ImageMetadata | null;
    caption?: string;
    isOpen: boolean;
    onClose: () => void;
  }

  let { image, caption, isOpen, onClose }: Props = $props();

  function getImageSrc(image: string | ImageMetadata | null): string {
    if (!image) return '';
    if (typeof image === 'string') {
      return image;
    }
    return image.src;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (e.target === e.currentTarget) {
        onClose();
      }
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  $effect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeydown);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeydown);
        document.body.style.overflow = '';
      };
    }
  });
</script>

{#if isOpen && image}
  <div 
    class="lightbox-backdrop" 
    in:fade={{ duration: 240 }}
    out:fade={{ duration: 220 }}
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    tabindex="0"
    role="dialog"
    aria-modal="true"
    aria-label="Image viewer"
  >
    <button 
      class="lightbox-close"
      onclick={onClose}
      aria-label="Close image viewer"
    >
      ×
    </button>
    <div
      class="lightbox-content"
      in:scale={{ duration: 320, start: 0.96 }}
      out:scale={{ duration: 220, start: 1, end: 0.985 }}
    >
      <img 
        src={getImageSrc(image)} 
        alt={caption || 'Gallery image'}
        class="lightbox-image"
      />
      {#if caption}
        <div class="lightbox-caption">{caption}</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .lightbox-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 2rem;
    cursor: pointer;
  }

  .lightbox-close {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease, border-color 0.2s ease;
    z-index: 1001;
    font-family: 'SUSE Mono', monospace;
  }

  .lightbox-close:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .lightbox-content {
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: default;
  }

  .lightbox-image {
    max-width: 100%;
    max-height: calc(90vh - 4rem);
    object-fit: contain;
  }

  .lightbox-caption {
    margin-top: 1.5rem;
    color: white;
    text-align: center;
    font-family: 'SUSE Mono', monospace;
    font-size: 0.9rem;
    max-width: 80vw;
    line-height: 1.5;
    padding: 0 1rem;
  }

  @media (max-width: 640px) {
    .lightbox-backdrop {
      padding: 1rem;
    }

    .lightbox-close {
      top: 1rem;
      right: 1rem;
      width: 36px;
      height: 36px;
      font-size: 1.25rem;
    }

    .lightbox-caption {
      font-size: 0.8rem;
      margin-top: 1rem;
    }
  }
</style>
