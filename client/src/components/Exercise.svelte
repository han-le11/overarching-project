<script>
  export let id;

  let exercise = null;
  let loading = true;
  let error = '';

  let text = '';

  let submissionId = null;
  let gradingStatus = '';
  let grade = null;
  let polling = false;
  let submitError = '';

  const handleSubmit = async () => {
    submitError = '';
    gradingStatus = '';
    grade = null;

    try {
      const response = await fetch(`/api/exercises/${id}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source_code: text }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit exercise');
      }

      const result = await response.json();
      submissionId = result.id ?? result.submission_id ?? null;

      if (!submissionId) {
        throw new Error('Submission id missing from response');
      }

      startPolling(submissionId);
    } catch (err) {
      submitError = err.message ?? 'Failed to submit exercise';
    }
  };

  const pollSubmissionStatus = async (id) => {
    try {
      const response = await fetch(`/api/submissions/${id}/status`);
      if (!response.ok) {
        throw new Error('Failed to fetch submission status');
      }

      const status = await response.json();
      gradingStatus = status.grading_status ?? '';
      grade = status.grade ?? null;

      if (gradingStatus === 'graded') {
        polling = false;
      }
    } catch (err) {
      // Stop polling on error to avoid infinite loops
      polling = false;
      submitError = err.message ?? 'Failed to fetch submission status';
    }
  };

  const startPolling = (id) => {
    polling = true;

    const poll = async () => {
      if (!polling) return;

      await pollSubmissionStatus(id);

      if (polling && gradingStatus !== 'graded') {
        setTimeout(poll, 500);
      }
    };

    poll();
  };

  const fetchExercise = async () => {
    try {
      const response = await fetch(`/api/exercises/${id}`);
      if (!response.ok) {
        throw new Error('Failed to load exercise');
      }
      exercise = await response.json();
    } catch (err) {
      error = err.message ?? 'Failed to load exercise';
    } finally {
      loading = false;
    }
  };

  $: if (id) {
    fetchExercise();
  }
</script>

{#if loading}
  <p>Loading...</p>
{:else if error}
  <p>{error}</p>
{:else if exercise}
  <h1>{exercise.title}</h1>
  <p>{exercise.description}</p>

  <label for="exercise-textarea">Source code</label>
  <textarea
    id="exercise-textarea"
    name="source_code"
    placeholder="Type your solution here"
    data-testid="exercise-textarea"
    bind:value={text}
  ></textarea>
  <button type="button" on:click={handleSubmit}>Submit</button>
  {#if submitError}
    <p>{submitError}</p>
  {/if}

  {#if gradingStatus}
    <p>Grading status: {gradingStatus}</p>
  {/if}

  {#if grade !== null}
    <p>Grade: {grade}</p>
  {/if}

{/if}
