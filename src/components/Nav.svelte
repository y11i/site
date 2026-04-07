<script lang="ts">
  export let currentPage: string = 'home';

  const pages = [
    { path: '/', label: 'home', slug: 'home' },
    { path: '/now', label: 'now', slug: 'now' },
    { path: '/photos', label: 'photos', slug: 'photos' }
  ];

  // Check if a page is active
  function isActive(slug: string): boolean {
    return slug === currentPage;
  }
</script>

<header class="nav-container">
  <h1 class="page-title">
    <strong>Y</strong>eon<strong>s</strong>eung <strong>C</strong>hoi
  </h1>
  <nav class="nav-links">
    {#each pages as page, index}
      <a 
        href={page.path} 
        class:active={isActive(page.slug)}
        aria-current={isActive(page.slug) ? 'page' : undefined}
      >
        {page.label}
      </a>
      {#if index < pages.length - 1}
        <span class="separator">•</span>
      {/if}
    {/each}
  </nav>
</header>

<style>
  .nav-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4.5rem 1rem 2rem;
    text-align: center;
  }

  .page-title {
    font-size: clamp(2rem, 4vw, 2.25rem);
    font-weight: 400;
    margin: 0 0 .5rem 0;
    letter-spacing: 0.03em;
    line-height: 1.2;
  }

  .nav-links {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 400;
  }

  .nav-links a {
    color: #999;
    text-decoration: none;
    transition: color 0.2s ease;
    padding: 0.25rem 0;
  }

  .nav-links a:hover {
    color: #666;
  }

  .nav-links a.active {
    color: #333;
    font-weight: 600;
  }

  .separator {
    color: #ccc;
    margin: 0 0.25rem;
    user-select: none;
  }

  @media (max-width: 640px) {
    .nav-container {
      padding: 3.5rem 1rem 1.75rem;
    }
  }
</style>
