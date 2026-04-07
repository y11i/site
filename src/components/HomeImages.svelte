<script lang="ts">
	import type { ImageMetadata } from 'astro';

	export let canyonlands: ImageMetadata;
	export let yosemite: ImageMetadata;
	export let zion: ImageMetadata;
</script>

<img 
	class="image-1"
	src={canyonlands.src}
	alt="Canyonlands" 
	width={400}
	height={300}
	loading="lazy"
	data-motion="image"
	data-motion-repeat="false"
	style="--motion-delay: 80ms;"
/>

<img 
	class="image-2"
	src={yosemite.src}
	alt="Yosemite" 
	width={400}
	height={300}
	loading="lazy"
	data-motion="image"
	data-motion-repeat="false"
	style="--motion-delay: 180ms;"
/>

<img 
	class="image-3"
	src={zion.src}
	alt="Zion" 
	width={400}
	height={300}
	loading="lazy"
	data-motion="image"
	data-motion-repeat="false"
	style="--motion-delay: 280ms;"
/>

<style>
	img {
		position: absolute;
		width: 400px;
		height: auto;
		border-radius: 8px;
		object-fit: cover;
		z-index: 1;
	}

	.image-1 {
		top: 5%;
		left: 5%;
		transform: rotate(-8deg);
		--motion-transform-hidden: rotate(-8deg);
		--motion-transform-visible: rotate(-8deg);
	}

	.image-2 {
		top: 20%;
		right: 10%;
		transform: rotate(12deg);
		--motion-transform-hidden: rotate(12deg);
		--motion-transform-visible: rotate(12deg);
	}

	.image-3 {
		bottom: 10%;
		left: 15%;
		transform: rotate(-5deg);
		--motion-transform-hidden: rotate(-5deg);
		--motion-transform-visible: rotate(-5deg);
	}

	@media (max-width: 1200px) {
		img {
			display: none;
		}
	}
</style>
