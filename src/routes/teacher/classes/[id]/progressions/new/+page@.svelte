<script lang="ts">
  import type { Problem } from "$lib/quizProblems";
  import { page } from "$app/stores";
  import ProgressionEditor from "$lib/ProgressionEditor.svelte";

  type Quiz = { id: string; data: { title: string; problems?: Problem[] } };
  export let data: { quizzes: Quiz[] };
</script>

<svelte:head><title>New progression · Fact Friends</title></svelte:head>

<ProgressionEditor classId={String($page.params.id)} quizzes={data.quizzes} />
