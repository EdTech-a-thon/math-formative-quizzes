<script lang="ts">
  import { beforeNavigate, goto } from "$app/navigation";
  import AddQuestionsDialog from "$lib/AddQuestionsDialog.svelte";
  import Icon from "$lib/Icon.svelte";
  import IconPicker from "$lib/IconPicker.svelte";
  import { shadeClass, type ShadeId } from "$lib/shades";
  import { readProblems, symbolFor, type Problem } from "$lib/quizProblems";

  type QuizData = { title: string; problems: Problem[]; timeLimitMinutes: number; showScore: boolean; passMessage: string; icon: string | null; shade: ShadeId | null };

  export let classId: string;
  export let quiz: { id: string; data: Partial<QuizData> } | null = null;

  const editing = Boolean(quiz?.id);
  let title = quiz?.data?.title ?? "";
  // The quiz is simply this list. Nothing generates it on the fly any more, so
  // the order here is exactly the order a student sits.
  let problems: Problem[] = readProblems(quiz?.data?.problems);
  let timeLimitMinutes = quiz?.data?.timeLimitMinutes ?? 2;
  let showScore = quiz?.data?.showScore ?? true;
  let passMessage = quiz?.data?.passMessage ?? "Great work! You finished this quiz.";
  let icon: string | null = quiz?.data?.icon ?? null;
  let shade: ShadeId | null = quiz?.data?.shade ?? null;

  let adding = false; // Add-questions dialog open.
  let messageOpen = false; // Finished-message popover open.
  let error = "";
  let saving = false;
  let titleInvalid = false; // Set when a save is attempted with no name; clears as soon as one is typed.
  let titleInput: HTMLInputElement | undefined;
  $: if (title.trim()) titleInvalid = false;

  // A quiz has no operation of its own, so its colour is purely the shade the
  // teacher picked, falling back to the house purple.
  $: sheetClass = shadeClass(shade);

  const snapshot = (values: unknown[]) => JSON.stringify(values);
  const savedState = snapshot([title, problems, timeLimitMinutes, showScore, passMessage, icon, shade]);
  $: dirty = !saving && snapshot([title, problems, timeLimitMinutes, showScore, passMessage, icon, shade]) !== savedState;
  beforeNavigate((navigation) => {
    if (!dirty) return;
    // Closing the tab can only be warned about by the browser's own dialog,
    // which cancelling a "leave" navigation asks for.
    if (navigation.type === "leave") { navigation.cancel(); return; }
    if (!confirm("You have unsaved changes to this quiz. Leave without saving?")) navigation.cancel();
  });

  // ---- Selecting questions: click one, shift-click a run, ctrl/cmd-click to pick out several ----
  let selected = new Set<string>();
  let anchor: string | null = null; // Where a shift-click measures its range from.

  function pick(id: string, index: number, event: MouseEvent) {
    if (event.shiftKey && anchor) {
      const start = problems.findIndex((item) => item.id === anchor);
      if (start >= 0) {
        const [low, high] = start < index ? [start, index] : [index, start];
        const run = problems.slice(low, high + 1).map((item) => item.id);
        selected = new Set([...selected, ...run]);
        return;
      }
    }
    if (event.metaKey || event.ctrlKey) {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      selected = next;
    } else {
      // Clicking the only selected tile again clears it, so a stray click undoes itself.
      selected = selected.size === 1 && selected.has(id) ? new Set() : new Set([id]);
    }
    anchor = id;
  }
  function removeOne(id: string) {
    problems = problems.filter((item) => item.id !== id);
    if (selected.has(id)) { const next = new Set(selected); next.delete(id); selected = next; }
  }
  function removeSelected() {
    problems = problems.filter((item) => !selected.has(item.id));
    selected = new Set();
    anchor = null;
  }
  function selectAll() {
    selected = new Set(problems.map((item) => item.id));
  }
  // Escape clears a selection and Delete removes it, but never while a field has focus.
  function onKeydown(event: KeyboardEvent) {
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (event.key === "Escape") { selected = new Set(); return; }
    if ((event.key === "Delete" || event.key === "Backspace") && selected.size) {
      event.preventDefault();
      removeSelected();
    }
  }

  // ---- Dragging questions into order ----
  let dragIndex: number | null = null;

  function move(from: number, to: number) {
    if (to < 0 || to >= problems.length || from === to) return;
    const next = [...problems];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    problems = next;
  }
  function startDrag(index: number, event: DragEvent) {
    dragIndex = index;
    event.dataTransfer?.setData("text/plain", problems[index].id); // Firefox needs some payload to start a drag.
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }
  // Reorder as the pointer passes over a neighbour, so the sheet previews the drop.
  function dragOver(index: number, event: DragEvent) {
    event.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    move(dragIndex, index);
    dragIndex = index;
  }
  // Arrow keys move a question without a mouse; the grip keeps focus as it travels.
  function nudge(index: number, event: KeyboardEvent) {
    const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : 0;
    if (!delta) return;
    event.preventDefault();
    move(index, index + delta);
  }

  function addProblems(incoming: Problem[]) {
    problems = [...problems, ...incoming];
  }
  function stepTime(delta: number) {
    timeLimitMinutes = Math.min(60, Math.max(1, timeLimitMinutes + delta));
  }
  function printWorksheet() {
    if (typeof window !== "undefined") window.print();
  }

  async function save() {
    if (!title.trim()) { titleInvalid = true; error = ""; titleInput?.focus(); return; }
    if (!problems.length) { error = "Add at least one question before saving."; return; }
    if (problems.length > 150) { error = "Keep the quiz to 150 questions or fewer."; return; }
    saving = true; error = "";
    const data = { title: title.trim(), problems, timeLimitMinutes, showScore, passMessage: passMessage.trim(), icon, shade };
    try {
      const response = editing
        ? await fetch(`/api/quizzes/${quiz?.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) })
        : await fetch("/api/quizzes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ class: classId, data }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      await goto(`/teacher/classes/${classId}/quizzes`);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "We could not save this quiz.";
      saving = false;
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div class={`editor-screen ${sheetClass}`}>
  <header class="editor-bar editor-bar-quiz">
    <a class="editor-back" href={`/teacher/classes/${classId}/quizzes`}><Icon name="arrow-left" size={14} /> Quizzes</a>

    <div class="bar-title-row">
      <IconPicker {shade} name={icon} fallback="clipboard-list" compact title="Quiz icon and colour" onChange={(next) => { icon = next.name; shade = next.shade; }} />
      <input class="bar-title" class:invalid={titleInvalid} bind:this={titleInput} bind:value={title} placeholder="Untitled quiz" aria-label="Quiz name" aria-invalid={titleInvalid} spellcheck="false" />
    </div>

    <div class="bar-settings">
      <div class="stepper stepper-compact" title="Time limit">
        <button type="button" on:click={() => stepTime(-1)} aria-label="Less time"><Icon name="minus" size={15} /></button>
        <b>{timeLimitMinutes}<small>min</small></b>
        <button type="button" on:click={() => stepTime(1)} aria-label="More time"><Icon name="plus" size={15} /></button>
      </div>

      <button type="button" class="bar-toggle" class:on={showScore} role="switch" aria-checked={showScore} on:click={() => (showScore = !showScore)}>
        <Icon name={showScore ? "check" : "x"} size={14} /> {showScore ? "Score shown" : "Score hidden"}
      </button>

      <div class="bar-popover-wrap">
        <button type="button" class="bar-toggle" aria-expanded={messageOpen} aria-haspopup="dialog" on:click|stopPropagation={() => (messageOpen = !messageOpen)}>
          <Icon name="smile" size={14} /> Finished message
        </button>
        {#if messageOpen}
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="icon-picker-backdrop" role="presentation" on:click={() => (messageOpen = false)}></div>
          <div class="bar-popover" role="dialog" aria-label="Finished message">
            <p class="doc-note">The cheer students see when they finish this quiz.</p>
            <input class="doc-inline-input" bind:value={passMessage} placeholder="Great work! You finished this quiz." maxlength="120" />
          </div>
        {/if}
      </div>
    </div>

    <div class="editor-bar-actions">
      <button class="editor-ghost" type="button" on:click={printWorksheet}><Icon name="printer" size={15} /> Print</button>
      <a class="editor-cancel" href={`/teacher/classes/${classId}/quizzes`}>Cancel</a>
      <button class="editor-save" type="button" disabled={saving} on:click={save}>{saving ? "Saving…" : editing ? "Save changes" : "Save quiz"}</button>
    </div>
  </header>

  <div class="editor-body editor-body-single">
    <div class="editor-canvas">
      <div class="doc-sheet">
        <div class="sheet-head">
          <p class="doc-eyebrow">Quiz</p>
          <p class="doc-summary">{problems.length} question{problems.length === 1 ? "" : "s"} · {timeLimitMinutes} min · {showScore ? "score shown" : "score hidden"} at the end</p>
        </div>
        {#if titleInvalid}<p class="doc-title-error" role="alert">Give your quiz a name up in the bar before saving.</p>{/if}

        {#if selected.size}
          <div class="bulk-bar" role="region" aria-label="Selected questions">
            <span class="bulk-count">{selected.size} selected</span>
            <button type="button" class="bulk-assign" on:click={removeSelected}>Delete</button>
            <button type="button" class="bulk-clear" on:click={selectAll}>Select all</button>
            <button type="button" class="bulk-clear" on:click={() => (selected = new Set())}>Clear</button>
          </div>
        {/if}

        {#if problems.length}
          <p class="sheet-hint">Drag a question to move it · click to select, shift-click for a run</p>
          <ol class="sheet-grid">
            {#each problems as problem, index (problem.id)}
              <li
                class="sheet-tile"
                class:selected={selected.has(problem.id)}
                class:dragging={dragIndex === index}
                draggable="true"
                on:dragstart={(event) => startDrag(index, event)}
                on:dragover={(event) => dragOver(index, event)}
                on:drop|preventDefault={() => (dragIndex = null)}
                on:dragend={() => (dragIndex = null)}
              >
                <button type="button" class="sheet-pick" aria-pressed={selected.has(problem.id)} on:click={(event) => pick(problem.id, index, event)}>
                  <span class="wp-num">{index + 1}</span>
                  <span class="wp-stack">
                    <b>{problem.top}</b>
                    <b>{symbolFor(problem.op)} {problem.bottom}</b>
                    <i></i>
                    <span class="wp-blank"></span>
                  </span>
                </button>
                <button
                  type="button"
                  class="sheet-grip"
                  aria-label={`Move ${problem.top} ${symbolFor(problem.op)} ${problem.bottom} — question ${index + 1} of ${problems.length}. Use the arrow keys.`}
                  on:keydown={(event) => nudge(index, event)}
                ><Icon name="grip-vertical" size={14} /></button>
                <button type="button" class="sheet-remove" aria-label={`Remove question ${index + 1}`} on:click={() => removeOne(problem.id)}><Icon name="x" size={12} /></button>
              </li>
            {/each}
            <li class="sheet-add">
              <button type="button" on:click={() => (adding = true)}><Icon name="plus" size={16} /> Add questions</button>
            </li>
          </ol>
        {:else}
          <button type="button" class="sheet-empty" on:click={() => (adding = true)}>
            <Icon name="plus" size={22} />
            <strong>Add your first question</strong>
            <small>Build a set of math facts, or write one of your own.</small>
          </button>
        {/if}

        {#if error}<p class="doc-error">{error}</p>{/if}
      </div>
    </div>
  </div>

  {#if adding}
    <AddQuestionsDialog onAdd={addProblems} onClose={() => (adding = false)} />
  {/if}

  <div class="print-sheet">
    <div class="print-head">
      <h1>{title.trim() || "Untitled quiz"}</h1>
      <div class="print-meta"><span>Name: ____________________</span><span>Date: ____________</span><span>{timeLimitMinutes} min · {problems.length} questions</span></div>
    </div>
    <ol class="print-grid">
      {#each problems as problem, index (problem.id)}
        <li class="print-problem"><span class="pp-num">{index + 1}.</span><div class="pp-stack"><b>{problem.top}</b><b>{symbolFor(problem.op)} {problem.bottom}</b><i></i><span class="pp-answer"></span></div></li>
      {/each}
    </ol>
  </div>
</div>
