<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import Icon from "$lib/Icon.svelte";

  type Operation = "multiplication" | "division" | "addition" | "subtraction";
  type Quiz = { id: string; data: { title: string; operation: Operation; questionCount: number; timeLimitMinutes: number } };
  type Usage = Record<string, { progressions: number; attempts: number }>;
  type Group = { id: string; name: string; operation: string; quizzes: Quiz[] };
  export let data: { ungrouped: Quiz[]; progressionGroups: Group[]; usage: Usage };

  const details: Record<Operation, { label: string; symbol: string }> = {
    multiplication: { label: "Multiplication", symbol: "×" }, division: { label: "Division", symbol: "÷" }, addition: { label: "Addition", symbol: "+" }, subtraction: { label: "Subtraction", symbol: "−" },
  };
  $: base = `/teacher/classes/${$page.params.id}/quizzes`;
  let deletingId: string | null = null;
  let error = "";
  let collapsed: Record<string, boolean> = {};
  function toggle(id: string) { collapsed = { ...collapsed, [id]: !collapsed[id] }; }

  async function deleteQuiz(event: MouseEvent, quiz: Quiz) {
    event.preventDefault();
    event.stopPropagation();
    const use = data.usage[quiz.id];
    let warning = `Delete "${quiz.data.title}"? This cannot be undone.`;
    if (use?.progressions) warning += `\n\nThis quiz is used in ${use.progressions} progression step${use.progressions === 1 ? "" : "s"}, which will also be removed.`;
    if (use?.attempts) warning += `\n\nStudents have ${use.attempts} recorded attempt${use.attempts === 1 ? "" : "s"} for this quiz.`;
    if (!confirm(warning)) return;
    deletingId = quiz.id; error = "";
    try {
      const response = await fetch(`/api/quizzes/${quiz.id}`, { method: "DELETE" });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.message); }
      await invalidateAll();
    } catch (caught) { error = caught instanceof Error ? caught.message : "We could not delete this quiz."; } finally { deletingId = null; }
  }
</script>

{#snippet quizCard(quiz: Quiz)}
  <a class="library-card" href={`${base}/${quiz.id}`}>
    <span class={`quiz-operation op-${quiz.data.operation}`}>{details[quiz.data.operation]?.symbol ?? "?"}</span>
    <div class="library-card-body">
      <h2>{quiz.data.title}</h2>
      <p>{details[quiz.data.operation]?.label ?? quiz.data.operation} · {quiz.data.questionCount} questions · {quiz.data.timeLimitMinutes} min{#if data.usage[quiz.id]?.progressions} · in {data.usage[quiz.id].progressions} progression step{data.usage[quiz.id].progressions === 1 ? "" : "s"}{/if}</p>
    </div>
    <span class="library-edit-hint">Edit <Icon name="arrow-right" size={14} /></span>
    <button type="button" class="ghost-btn danger" disabled={deletingId === quiz.id} on:click={(event) => deleteQuiz(event, quiz)}>{deletingId === quiz.id ? "Deleting…" : "Delete"}</button>
  </a>
{/snippet}

<section class="workspace-page">
  <header class="workspace-heading"><div><p class="eyebrow">QUIZ LIBRARY</p><h1>Quizzes</h1><p>Grouped by progression, in the order students work through them. Loose quizzes sit up top.</p></div><a class="primary-action" href={`${base}/new`}><Icon name="plus" size={15} /> New quiz</a></header>
  {#if error}<p class="message error">{error}</p>{/if}

  {#if data.ungrouped.length || data.progressionGroups.length}
    <div class="library-sections">
      {#if data.ungrouped.length}
        <section class="quiz-section">
          <button type="button" class="quiz-section-head" aria-expanded={!collapsed["__ungrouped"]} on:click={() => toggle("__ungrouped")}>
            <span class="quiz-section-chevron" class:collapsed={collapsed["__ungrouped"]}><Icon name="chevron-down" size={14} /></span>
            <span class="quiz-section-count">{data.ungrouped.length}</span>
          </button>
          {#if !collapsed["__ungrouped"]}
            <div class="library-list">{#each data.ungrouped as quiz}{@render quizCard(quiz)}{/each}</div>
          {/if}
        </section>
      {/if}
      {#each data.progressionGroups as group}
        <section class="quiz-section">
          <button type="button" class="quiz-section-head" aria-expanded={!collapsed[group.id]} on:click={() => toggle(group.id)}>
            <span class="quiz-section-chevron" class:collapsed={collapsed[group.id]}><Icon name="chevron-down" size={14} /></span>
            <span class="quiz-section-title">{group.name}</span>
            <span class="quiz-section-count">{group.quizzes.length}</span>
          </button>
          {#if !collapsed[group.id]}
            <div class="library-list">{#each group.quizzes as quiz}{@render quizCard(quiz)}{/each}</div>
          {/if}
        </section>
      {/each}
    </div>
  {:else}
    <section class="library-list"><a class="empty-workspace empty-link" href={`${base}/new`}><span><Icon name="clipboard-list" size={22} /></span><h2>No quizzes yet</h2><p>Start with a quiz, then add it to a progression whenever you are ready.</p></a></section>
  {/if}
</section>
