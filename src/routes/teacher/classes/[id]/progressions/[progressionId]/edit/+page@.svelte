<script lang="ts">
  import type { Problem } from "$lib/quizProblems";
  import { page } from "$app/stores";
  import ProgressionEditor from "$lib/ProgressionEditor.svelte";
  import type { ShadeId } from "$lib/shades";

  type Quiz = { id: string; data: { title: string; problems?: Problem[] } };
  type Progression = { id: string; name: string; description: string; passPercentage: number; quizIds: string[]; icon: string | null; shade: ShadeId | null };
  export let data: { quizzes: Quiz[]; progression: Progression };
</script>

<svelte:head><title>Edit progression · Fact Friends</title></svelte:head>

<ProgressionEditor classId={String($page.params.id)} quizzes={data.quizzes} progression={data.progression} />
