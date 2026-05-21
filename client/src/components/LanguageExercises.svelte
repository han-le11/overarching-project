<script>
    export let id;

    // state variables
    let exercises = [];
    let loading = true;
    let error = "";

    const fetchExercises = async () => {
      try {
        const response = await fetch(`/api/languages/${id}/exercises`);
        if (!response.ok) {
          throw new Error("Failed to load exercises");
        }
        exercises = await response.json();
      } catch (err) {
        error = err.message ?? "Failed to load exercises";
      } finally {
        loading = false;
      }
    };

    // fetch when the component is mounted / id is set
    $: if (id) {
      fetchExercises();
    }
</script>

<!-- level one heading -->
<h1>Available exercises</h1>

{#if loading}
    <p>Loading...</p>
{:else if error}
    <p>{error}</p>
{:else}
    <ul>
      {#each exercises as exercise}
        <li>
          <a href={`/exercises/${exercise.id}`}>
            {exercise.title}
          </a>
        </li>
      {/each}
    </ul>
{/if}
