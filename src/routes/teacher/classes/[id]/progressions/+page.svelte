<script lang="ts">
  import type { Problem } from "$lib/quizProblems";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import Icon from "$lib/Icon.svelte";
  import ImportButton from "$lib/ImportButton.svelte";
  import ImportDropTarget from "$lib/ImportDropTarget.svelte";
  import IconPicker from "$lib/IconPicker.svelte";
  import { shadeClass, type ShadeId } from "$lib/shades";
  type Quiz = { id: string; data: { title: string; problems?: Problem[] } };
  type Progression = { id: string; name: string; description: string; passPercentage: number; operation?: string; shade?: ShadeId; icon?: string; studentCount: number; waitingCount: number; releasedCount: number };
  export let data: { quizzes: Quiz[]; progressions: Progression[]; steps: { progression: string; position: number; expand?: { quiz?: Quiz } }[] };
  $: base = `/teacher/classes/${$page.params.id}/progressions`;
  let error = "";
  let message = "";
  let releasing = "";
  // Step titles in path order, read left to right on a single line.
  function stepTitles(id: string) {
    return data.steps
      .filter((step) => step.progression === id)
      .sort((a, b) => a.position - b.position)
      .map((step) => step.expand?.quiz?.data.title || "Quiz");
  }

  // The icon on a card is editable in place: show the pick straight away, then
  // save it on its own without touching the rest of the progression.
  async function setAppearance(progression: Progression, next: { name: string | null; shade: ShadeId | null }) {
    const previous = { icon: progression.icon, shade: progression.shade };
    progression.icon = next.name ?? undefined;
    progression.shade = next.shade ?? undefined;
    data = data;
    error = "";
    try {
      const response = await fetch(`/api/progressions/${progression.id}/appearance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icon: next.name, shade: next.shade }),
      });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.message); }
      await invalidateAll();
    } catch (caught) {
      Object.assign(progression, previous);
      data = data;
      error = caught instanceof Error ? caught.message : "We could not update this progression.";
    }
  }

  async function releaseProgression(progression: Progression) {
    const students = `${progression.waitingCount} ${progression.waitingCount === 1 ? "student" : "students"}`;
    if (!confirm(`Release the next attempt in ${progression.name} for ${students}?\n\nThey will be able to start the quiz right away.`)) return;
    releasing = progression.id;
    error = "";
    message = "";
    try {
      const response = await fetch("/api/enrollments/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progression: progression.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message);
      await invalidateAll();
      message = result.released
        ? `${result.released} ${result.released === 1 ? "student is" : "students are"} ready for their next attempt in ${progression.name}.`
        : `Everyone in ${progression.name} is ready or finished already.`;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "We could not release these attempts.";
    } finally {
      releasing = "";
    }
  }
</script>

<ImportDropTarget classId={String($page.params.id)}>
<section class="workspace-page"><header class="workspace-heading"><div><p class="eyebrow">LEARNING PATHS</p><h1>Progressions</h1><p>Release one attempt when your class is ready. After each attempt, students wait for you to release the next one.</p></div><div class="workspace-heading-actions"><ImportButton classId={String($page.params.id)} /><a class="primary-action" href={`${base}/new`}><Icon name="plus" size={15} /> New progression</a></div></header>
  {#if error}<p class="message error">{error}</p>{/if}
  {#if message}<p class="message success">{message}</p>{/if}
  <section class="progression-list">{#if data.progressions.length}{#each data.progressions as progression (progression.id)}{@const titles = stepTitles(progression.id)}<article class={`progression-card ${shadeClass(progression.shade, progression.operation)}`}>
      <IconPicker compact name={progression.icon ?? null} shade={progression.shade ?? null} fallback="route" title={`Icon and colour for ${progression.name}`} defaultShadeLabel="House purple" onChange={(next) => setAppearance(progression, next)} />
      <a class="progression-card-link" href={`${base}/${progression.id}`}>
        <div class="progression-card-body">
          <h2>{progression.name}</h2>
          <p>{progression.passPercentage}% to pass · {titles.length} step{titles.length === 1 ? "" : "s"} · {progression.studentCount} student{progression.studentCount === 1 ? "" : "s"}</p>
          {#if progression.description}<p class="progression-description">{progression.description}</p>{/if}
        </div>
      </a>
      <div class="progression-release">
        <div class="progression-card-actions">
          <a class="progression-card-edit" href={`${base}/${progression.id}/edit`} aria-label={`Edit ${progression.name}`} title={`Edit ${progression.name}`}><Icon name="pencil" size={15} /></a>
          <button type="button" disabled={!progression.waitingCount || releasing === progression.id} on:click={() => releaseProgression(progression)}>
            <Icon name={progression.waitingCount ? "unlock" : "check"} size={14} />
            {releasing === progression.id ? "Releasing…" : progression.waitingCount ? `Release ${progression.waitingCount}` : "All ready"}
          </button>
        </div>
      </div>
    </article>{/each}{:else}<a class="empty-workspace empty-link" href={`${base}/new`}><span><Icon name="route" size={22} /></span><h2>No progressions yet</h2><p>Create a sequence of quizzes. Students will retry a step until they meet the progression's passing score.</p></a>{/if}</section>
</section>
</ImportDropTarget>
