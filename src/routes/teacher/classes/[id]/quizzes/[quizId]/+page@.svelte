<script lang="ts">
  import { page } from "$app/stores";
  import QuizEditor from "$lib/QuizEditor.svelte";
  export let data: { quiz: { id: string; data: Record<string, unknown> } };
</script>

<svelte:head><title>Edit quiz · Fact Friends</title></svelte:head>

<QuizEditor classId={String($page.params.id)} quiz={data.quiz} />
