<script lang="ts">
  import { page } from "$app/stores";
  import Icon from "$lib/Icon.svelte";
  type Quiz = { id: string; data: { title: string; operation: string; questionCount: number } };
  type Progression = { id: string; name: string; description: string; passPercentage: number; status: string; operation?: string };
  export let data: { quizzes: Quiz[]; progressions: Progression[]; steps: { progression: string; position: number; expand?: { quiz?: Quiz } }[] };
  $: base = `/teacher/classes/${$page.params.id}/progressions`;
  function stepsFor(id: string) { return data.steps.filter((step) => step.progression === id).sort((a, b) => a.position - b.position); }
</script>

<section class="workspace-page"><header class="workspace-heading"><div><p class="eyebrow">LEARNING PATHS</p><h1>Progressions</h1><p>Set a pass percentage once. Learners retry each step until they pass and unlock the next quiz.</p></div><a class="primary-action" href={`${base}/new`}><Icon name="plus" size={15} /> New progression</a></header>
  <section class="progression-list">{#if data.progressions.length}{#each data.progressions as progression}<article class={`progression-card${progression.operation ? ` op-${progression.operation}` : ""}`}><header><div><span class="progression-icon"><Icon name="route" size={18} /></span><div><h2>{progression.name}</h2><p>{progression.passPercentage}% required to pass each step</p></div></div><span class="draft-tag">{progression.status}</span></header>{#if progression.description}<p class="progression-description">{progression.description}</p>{/if}<ol>{#each stepsFor(progression.id) as step}<li><span>{step.position}</span>{step.expand?.quiz?.data.title || "Quiz"}</li>{/each}</ol></article>{/each}{:else}<a class="empty-workspace empty-link" href={`${base}/new`}><span><Icon name="route" size={22} /></span><h2>No progressions yet</h2><p>Create a sequence of quizzes. Students will retry a step until they meet the progression's passing score.</p></a>{/if}</section>
</section>
