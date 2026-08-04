<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import Icon from "$lib/Icon.svelte";
  import ProgressionPreview from "$lib/ProgressionPreview.svelte";

  type Quiz = { id: string; data: { title: string; operation: string; questionCount: number } };
  export let data: { quizzes: Quiz[] };

  const symbols: Record<string, string> = { multiplication: "×", division: "÷", addition: "+", subtraction: "−" };
  const labels: Record<string, string> = { multiplication: "Multiplication", division: "Division", addition: "Addition", subtraction: "Subtraction" };
  const operationOrder = ["multiplication", "division", "addition", "subtraction"];
  $: classId = $page.params.id;
  $: base = `/teacher/classes/${classId}/progressions`;

  let name = "";
  let description = "";
  let passPercentage = 80;
  let quizIds: string[] = []; // Chosen quizzes, in the order learners will work through them.
  let error = "";
  let saving = false;

  // The preview's step list: the chosen quizzes, flattened, in path order.
  $: steps = quizIds
    .map((id) => data.quizzes.find((quiz) => quiz.id === id))
    .filter((quiz): quiz is Quiz => Boolean(quiz))
    .map((quiz) => ({ id: quiz.id, title: quiz.data.title, operation: quiz.data.operation, questionCount: quiz.data.questionCount }));

  // The filter only changes which quizzes are listed — never what's in the path.
  let operationFilter = "all";
  $: filterOptions = operationOrder.filter((operation) => data.quizzes.some((quiz) => quiz.data.operation === operation));
  $: listedQuizzes = data.quizzes
    .filter((quiz) => operationFilter === "all" || quiz.data.operation === operationFilter)
    .slice()
    .sort((a, b) => a.data.title.localeCompare(b.data.title, undefined, { sensitivity: "base" }));
  // Chosen quizzes the current filter is hiding — worth saying out loud so nobody thinks they fell out.
  $: hiddenChosen = quizIds.filter((id) => !listedQuizzes.some((quiz) => quiz.id === id)).length;

  // Ticking a quiz adds it to the end of the path; the order is set by dragging on the right.
  function toggle(id: string) {
    quizIds = quizIds.includes(id) ? quizIds.filter((item) => item !== id) : [...quizIds, id];
  }
  function stepPass(delta: number) {
    passPercentage = Math.min(100, Math.max(1, passPercentage + delta));
  }

  async function save() {
    if (!name.trim()) { error = "Give this learning path a name first."; return; }
    if (!quizIds.length) { error = "Add at least one quiz to the path."; return; }
    saving = true; error = "";
    try {
      const response = await fetch("/api/progressions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ class: classId, name: name.trim(), description: description.trim(), passPercentage, quizIds }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      await goto(base);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "We could not save this progression.";
      saving = false;
    }
  }
</script>

<svelte:head><title>New progression · Fact Friends</title></svelte:head>

<div class="editor-screen editor-screen-plain">
  <header class="editor-bar">
    <a class="editor-back" href={base}><Icon name="arrow-left" size={14} /> Progressions</a>
    <span class="editor-crumb">New progression</span>
    <div class="editor-bar-actions">
      <a class="editor-cancel" href={base}>Cancel</a>
      <button class="editor-save" type="button" disabled={saving} on:click={save}>{saving ? "Saving…" : "Save progression"}</button>
    </div>
  </header>

  <div class="editor-body">
    <div class="editor-canvas">
      <div class="doc-sheet">
        <p class="doc-eyebrow">Learning path</p>
        <input class="doc-title" bind:value={name} placeholder="Untitled path" aria-label="Progression name" spellcheck="false" />
        <input class="doc-inline-input doc-subtitle" bind:value={description} placeholder="Add an optional description…" maxlength="200" />

        <section class="doc-block">
          <div class="doc-row">
            <div><h2 class="doc-heading">Passing score</h2><p class="doc-note">Learners retry a step until they hit this, then unlock the next.</p></div>
            <div class="stepper"><button type="button" on:click={() => stepPass(-5)} aria-label="Lower passing score"><Icon name="minus" size={17} /></button><b>{passPercentage}<small>%</small></b><button type="button" on:click={() => stepPass(5)} aria-label="Raise passing score"><Icon name="plus" size={17} /></button></div>
          </div>
        </section>

        <section class="doc-block">
          <h2 class="doc-heading">Which quizzes are in this path?<span class="doc-hint">listed A–Z · tick the ones to include — drag them into order on the right</span></h2>
          {#if data.quizzes.length}
            <div class="picker-filters" role="group" aria-label="Show quizzes for">
              <button type="button" class="filter-pill" class:on={operationFilter === "all"} aria-pressed={operationFilter === "all"} on:click={() => (operationFilter = "all")}>All</button>
              {#each filterOptions as operation}
                <button type="button" class="filter-pill op-{operation}" class:on={operationFilter === operation} aria-pressed={operationFilter === operation} on:click={() => (operationFilter = operation)}><i>{symbols[operation]}</i> {labels[operation]}</button>
              {/each}
            </div>
            {#if hiddenChosen}
              <p class="picker-hidden-note">{hiddenChosen} quiz{hiddenChosen === 1 ? "" : "zes"} already in this path {hiddenChosen === 1 ? "is" : "are"} hidden by this filter — {hiddenChosen === 1 ? "it's" : "they're"} still in the path on the right.</p>
            {/if}
            <div class="step-picker">
              {#if !listedQuizzes.length}<p class="editor-note">No {labels[operationFilter]?.toLowerCase()} quizzes in this class yet.</p>{/if}
              {#each listedQuizzes as quiz (quiz.id)}
                {@const chosen = quizIds.includes(quiz.id)}
                <button type="button" class:chosen aria-pressed={chosen} on:click={() => toggle(quiz.id)}>
                  <span class="step-check">{#if chosen}<Icon name="check" size={14} />{/if}</span>
                  <div><strong>{quiz.data.title}</strong><small>{symbols[quiz.data.operation] ?? ""} {quiz.data.operation} · {quiz.data.questionCount} questions</small></div>
                </button>
              {/each}
            </div>
          {:else}
            <p class="editor-note">Create at least one quiz in the Quiz library before building a progression.</p>
          {/if}
        </section>

        {#if error}<p class="doc-error">{error}</p>{/if}
      </div>
    </div>

    <div class="editor-aside">
      <ProgressionPreview {name} {description} {passPercentage} {steps} onReorder={(ids) => (quizIds = ids)} onRemove={toggle} />
    </div>
  </div>
</div>
