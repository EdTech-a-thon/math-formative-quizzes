<script lang="ts">
  import { page } from "$app/stores";
  import QuizEditor from "$lib/QuizEditor.svelte";
</script>

<svelte:head><title>New quiz · Fact Friends</title></svelte:head>

<QuizEditor classId={String($page.params.id)} />
