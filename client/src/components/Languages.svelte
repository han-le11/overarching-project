<script>
    let languages = [];
    let loading = true;
    let error = '';

    const fetchLanguages = async () => {
        try {
        const response = await fetch('/api/languages');
        if (!response.ok) {
            throw new Error('Failed to load languages');
        }
        languages = await response.json();
        } catch (err) {
        error = err.message ?? 'Failed to load languages';
        } finally {
        loading = false;
        }
    };

    fetchLanguages();
</script>

<h1>Available languages</h1>

{#if loading}
    <p>Loading...</p>
{:else if error}
    <p>{error}</p>
{:else}
    <ul>
      {#each languages as language}
        <li>
          <a href={`/languages/${language.id}`}>
            {language.name}
          </a>
        </li>
      {/each}
    </ul>
{/if}

