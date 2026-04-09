<script lang="ts">
  import emblaCarouselSvelte from "embla-carousel-svelte";
  import type { ImageMetadata } from "astro";
  import type { EmblaCarouselType } from "embla-carousel";

  interface Props {
    images?: (string | ImageMetadata)[];
  }

  let { images = [] }: Props = $props();

  // Helper function to get image source
  function getImageSrc(image: string | ImageMetadata): string {
    if (typeof image === "string") {
      return image;
    }
    return image.src;
  }

  // Helper function to get image alt text
  function getImageAlt(image: string | ImageMetadata, index: number): string {
    return `Image ${index + 1}`;
  }

  let emblaOptions = {
    options: { loop: false },
    plugins: []
  };

  let emblaApi: EmblaCarouselType | undefined;
  let selectedIndex = $state(0);

  function onInit(event: CustomEvent<EmblaCarouselType>) {
    emblaApi = event.detail;
    selectedIndex = emblaApi.selectedScrollSnap();
    
    emblaApi.on("select", () => {
      selectedIndex = emblaApi?.selectedScrollSnap() ?? 0;
    });
  }

  function goToSlide(index: number) {
    emblaApi?.scrollTo(index);
  }
</script>

{#if images.length > 0}
  <div class="carousel-wrapper">
    <div class="embla" use:emblaCarouselSvelte={emblaOptions} onemblaInit={onInit}>
      <div class="embla__container">
        {#each images as image, index}
          <div class="embla__slide">
            <img
              src={getImageSrc(image)}
              alt={getImageAlt(image, index)}
              loading={index === 0 ? "eager" : "lazy"}
              fetchpriority={index === 0 ? "high" : "low"}
              decoding="async"
            />
          </div>
        {/each}
      </div>
    </div>
    
    <div class="dots">
      {#each images as _, index}
        <button
          class="dot"
          class:active={selectedIndex === index}
          onclick={() => goToSlide(index)}
          aria-label={`Go to slide ${index + 1}`}
        ></button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .carousel-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .embla {
    overflow: hidden;
  }

  .embla__container {
    display: flex;
    gap: 1rem;
  }

  .embla__slide {
    flex: 0 0 auto;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 90%;
  }

  .embla__slide img {
    max-width: 100%;
    max-height: 300px;
    height: auto;
    display: block;
  }

  .dots {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: none;
    background-color: #ccc;
    cursor: pointer;
    padding: 0;
    transition: background-color 0.2s;
  }

  .dot:hover {
    background-color: #999;
  }

  .dot.active {
    background-color: #333;
  }
</style>
