<script lang="ts">
  import { beforeNavigate, goto } from "$app/navigation";
  import Icon from "$lib/Icon.svelte";
  import IconPicker from "$lib/IconPicker.svelte";
  import ProgressionPreview from "$lib/ProgressionPreview.svelte";
  import { shadeClass, type ShadeId } from "$lib/shades";
  import type { Problem } from "$lib/quizProblems";

  type Quiz = { id: string; data: { title: string; problems?: Problem[] } };
  type Progression = { id: string; name: string; description: string; passPercentage: number; oneAtATime?: boolean; showAnswers?: boolean; quizIds: string[]; icon?: string | null; shade?: ShadeId | null };

  export let classId: string;
  export let quizzes: Quiz[];
  export let progression: Progression | null = null;

  const editing = Boolean(progression?.id);
  $: base = `/teacher/classes/${classId}/progressions`;
  $: returnPath = editing ? `${base}/${progression?.id}` : base;

  let name = progression?.name ?? "";
  let description = progression?.description ?? "";
  let passPercentage = progression?.passPercentage ?? 80;
  // How the steps of this path are shown to students — one question at a time,
  // or the whole sheet. It is a path-wide setting so the way a student meets a
  // quiz does not change from step to step.
  let oneAtATime = progression?.oneAtATime === true;
  // Whether a finished quiz hands the student their wrong answers back to study.
  let showAnswers = progression?.showAnswers === true;
  let quizIds: string[] = progression?.quizIds ?? []; // Chosen quizzes, in the order learners will work through them.
  let icon: string | null = progression?.icon || null;
  let shade: ShadeId | null = progression?.shade || null;
  let error = "";
  let saving = false;
  let quizSearch = "";

  // Everything a save would write, so leaving with edits in hand can be caught.
  const snapshot = (values: unknown[]) => JSON.stringify(values);
  const savedState = snapshot([name, description, passPercentage, oneAtATime, showAnswers, quizIds, icon, shade]);
  $: dirty = !saving && snapshot([name, description, passPercentage, oneAtATime, showAnswers, quizIds, icon, shade]) !== savedState;
  beforeNavigate((navigation) => {
    if (!dirty) return;
    // Closing the tab can only be warned about by the browser's own dialog,
    // which cancelling a "leave" navigation asks for.
    if (navigation.type === "leave") { navigation.cancel(); return; }
    if (!confirm("You have unsaved changes to this progression. Leave without saving?")) navigation.cancel();
  });

  // The preview's step list: the chosen quizzes, flattened, in path order.
  $: steps = quizIds
    .map((id) => quizzes.find((quiz) => quiz.id === id))
    .filter((quiz): quiz is Quiz => Boolean(quiz))
    .map((quiz) => ({ id: quiz.id, title: quiz.data.title, questionCount: (quiz.data.problems ?? []).length }));

  // Quizzes are no longer grouped by operation, so the whole library lists A–Z.
  $: listedQuizzes = quizzes
    .slice()
    .sort((a, b) => a.data.title.localeCompare(b.data.title, undefined, { sensitivity: "base" }));
  $: filteredQuizzes = listedQuizzes.filter((quiz) =>
    quiz.data.title.toLocaleLowerCase().includes(quizSearch.trim().toLocaleLowerCase()),
  );

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
    const body = { class: classId, name: name.trim(), description: description.trim(), passPercentage, oneAtATime, showAnswers, quizIds, icon, shade };
    try {
      const response = editing
        ? await fetch(`/api/progressions/${progression?.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/progressions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      await goto(returnPath);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "We could not save this progression.";
      saving = false;
    }
  }
</script>

<div class="editor-screen editor-screen-plain">
  <header class="editor-bar">
    <a class="editor-back" href={returnPath}><Icon name="arrow-left" size={14} /> {editing ? "Progression details" : "Progressions"}</a>
    <span class="editor-crumb">{editing ? "Editing progression" : "New progression"}</span>
    <div class="editor-bar-actions">
      <a class="editor-cancel" href={returnPath}>Cancel</a>
      <button class="editor-save" type="button" disabled={saving} on:click={save}>{saving ? "Saving…" : editing ? "Save changes" : "Save progression"}</button>
    </div>
  </header>

  <div class="editor-body">
    <div class="editor-canvas">
      <div class="doc-sheet">
        <p class="doc-eyebrow">Learning path</p>
        <div class={`doc-title-row ${shadeClass(shade)}`}>
          <IconPicker {shade} name={icon} fallback="route" title="Path icon and colour" defaultShadeLabel="House purple" onChange={(next) => { icon = next.name; shade = next.shade; }} />
          <input class="doc-title" bind:value={name} placeholder="Untitled path" aria-label="Progression name" spellcheck="false" />
        </div>
        <input class="doc-inline-input doc-subtitle" bind:value={description} placeholder="Add an optional description…" maxlength="200" />

        <section class="doc-block doc-inline-rows">
          <div class="doc-row">
            <div><h2 class="doc-heading">Passing score</h2><p class="doc-note">Learners retry a step until they hit this, then unlock the next.</p></div>
            <div class="stepper"><button type="button" on:click={() => stepPass(-5)} aria-label="Lower passing score"><Icon name="minus" size={17} /></button><b>{passPercentage}<small>%</small></b><button type="button" on:click={() => stepPass(5)} aria-label="Raise passing score"><Icon name="plus" size={17} /></button></div>
          </div>
          <div class="doc-row">
            <div><h2 class="doc-heading">How questions are shown</h2><p class="doc-note">Applies to every quiz in this path.</p></div>
            <button
              type="button"
              class="bar-toggle"
              class:on={oneAtATime}
              role="switch"
              aria-checked={oneAtATime}
              on:click={() => (oneAtATime = !oneAtATime)}
            >
              <Icon name={oneAtATime ? "square" : "layout-grid"} size={14} /> {oneAtATime ? "One at a time" : "All at once"}
            </button>
          </div>
          <div class="doc-row">
            <div><h2 class="doc-heading">Answers after a quiz</h2><p class="doc-note">Students see the questions they got wrong, with the right answer to study.</p></div>
            <button
              type="button"
              class="bar-toggle"
              class:on={showAnswers}
              role="switch"
              aria-checked={showAnswers}
              on:click={() => (showAnswers = !showAnswers)}
            >
              <Icon name={showAnswers ? "check" : "x"} size={14} /> {showAnswers ? "Answers shown" : "Answers hidden"}
            </button>
          </div>
        </section>

        <section class="doc-block">
          <h2 class="doc-heading">Which quizzes are in this path?<span class="doc-hint">listed A–Z · tick the ones to include — drag them into order on the right</span></h2>
          {#if quizzes.length}
            <label class="quiz-search">
              <span class="sr-only">Search quizzes</span>
              <Icon name="search" size={16} />
              <input type="search" bind:value={quizSearch} placeholder="Search quizzes…" />
            </label>
            {#if filteredQuizzes.length}
              <div class="step-picker">
                {#each filteredQuizzes as quiz (quiz.id)}
                  {@const chosen = quizIds.includes(quiz.id)}
                  <button type="button" class:chosen aria-pressed={chosen} on:click={() => toggle(quiz.id)}>
                    <span class="step-check">{#if chosen}<Icon name="check" size={14} />{/if}</span>
                    <div><strong>{quiz.data.title}</strong><small>{(quiz.data.problems ?? []).length} questions</small></div>
                  </button>
                {/each}
              </div>
            {:else}
              <p class="quiz-search-empty">No quizzes match “{quizSearch.trim()}”.</p>
            {/if}
          {:else}
            <p class="editor-note">Create at least one quiz in the Quiz library before building a progression.</p>
          {/if}
        </section>

        {#if error}<p class="doc-error">{error}</p>{/if}
      </div>
    </div>

    <div class="editor-aside">
      <ProgressionPreview {name} {description} {passPercentage} {steps} {shade} iconName={icon} onReorder={(ids) => (quizIds = ids)} onRemove={toggle} />
    </div>
  </div>
</div>

<style>
  .quiz-search {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 10px;
    border: 1px solid #e4ddec;
    border-radius: 10px;
    padding: 0 12px;
    background: #fff;
    color: #91899d;
  }

  .quiz-search:focus-within {
    border-color: var(--operation);
    box-shadow: 0 0 0 3px var(--operation-soft);
  }

  .quiz-search input {
    width: 100%;
    border: 0;
    padding: 10px 0;
    background: transparent;
    box-shadow: none;
    color: #26233a;
    font: inherit;
    outline: 0;
    text-align: left;
  }

  .quiz-search input:focus {
    border: 0;
    box-shadow: none;
  }

  .quiz-search-empty {
    margin: 14px 0 0;
    color: #81799a;
    font-size: .85rem;
  }
</style>
