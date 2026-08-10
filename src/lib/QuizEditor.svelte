<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { beforeNavigate, goto } from "$app/navigation";
  import FactFamilyPicker from "$lib/FactFamilyPicker.svelte";
  import Icon from "$lib/Icon.svelte";
  import IconPicker from "$lib/IconPicker.svelte";
  import ImportDropTarget from "$lib/ImportDropTarget.svelte";
  import { shadeClass, type ShadeId } from "$lib/shades";
  import { pushToast } from "$lib/toasts";
  import { makeProblem, operations, problemProblem, readProblems, symbolFor, type Operation, type Problem } from "$lib/quizProblems";

  type QuizData = { title: string; problems: Problem[]; timeLimitMinutes: number; showScore: boolean; oneAtATime: boolean; passMessage: string; icon: string | null; shade: ShadeId | null };

  export let classId: string;
  export let quiz: { id: string; data: Partial<QuizData> } | null = null;

  const editing = Boolean(quiz?.id);
  let title = quiz?.data?.title ?? "";
  // The quiz is simply this list. Nothing generates it on the fly any more, so
  // the order here is exactly the order a student sits.
  let problems: Problem[] = readProblems(quiz?.data?.problems);
  let timeLimitMinutes = quiz?.data?.timeLimitMinutes ?? 2;
  let showScore = quiz?.data?.showScore ?? true;
  // How the student meets the questions: the whole sheet at once, or one
  // question on screen at a time. It changes nothing about this editor.
  let oneAtATime = quiz?.data?.oneAtATime ?? false;
  let passMessage = quiz?.data?.passMessage ?? "Great work! You finished this quiz.";
  let icon: string | null = quiz?.data?.icon ?? null;
  let shade: ShadeId | null = quiz?.data?.shade ?? null;

  // Questions the fact-family panel would insert. They show in the quiz itself,
  // highlighted, until they are inserted for real or the panel goes quiet.
  let pending: Problem[] = [];
  let messageOpen = false; // Finished-message popover open.
  let exportOpen = false;
  let error = "";
  let saving = false;
  let titleInvalid = false; // Set when a save is attempted with no name; clears as soon as one is typed.
  let titleInput: HTMLInputElement | undefined;
  let sheetGrid: HTMLElement | undefined;
  $: if (title.trim()) titleInvalid = false;

  // A quiz has no operation of its own, so its colour is purely the shade the
  // teacher picked, falling back to the house purple.
  $: sheetClass = shadeClass(shade);
  // Division that does not come out even, or subtraction that goes below zero.
  // Flagged on the card as you type rather than blocking the edit.
  $: faults = new Map(problems.map((item) => [item.id, problemProblem(item.op, item.top, item.bottom)]).filter(([, note]) => note) as [string, string][]);

  const snapshot = (values: unknown[]) => JSON.stringify(values);
  const savedState = snapshot([title, problems, timeLimitMinutes, showScore, passMessage, icon, shade, oneAtATime]);
  $: state = snapshot([title, problems, timeLimitMinutes, showScore, passMessage, icon, shade, oneAtATime]);
  $: dirty = !saving && state !== savedState;
  beforeNavigate((navigation) => {
    if (!dirty) return;
    // Closing the tab can only be warned about by the browser's own dialog,
    // which cancelling a "leave" navigation asks for.
    if (navigation.type === "leave") { navigation.cancel(); return; }
    if (!confirm("You have unsaved changes to this quiz. Leave without saving?")) navigation.cancel();
  });

  // ---- Undo and redo ----
  // Whole-editor snapshots rather than a list of edit types: the state is small
  // and it means every control is covered without each one reporting itself.
  let past: string[] = [];
  let future: string[] = [];
  let last = savedState; // The newest state already accounted for.
  let burstFrom: string | null = null; // State before the current run of quick edits.
  let burstTimer: ReturnType<typeof setTimeout> | undefined;

  $: record(state);
  $: canUndo = past.length > 0 || burstFrom !== null;
  $: canRedo = future.length > 0;

  // A run of keystrokes lands as one undo step rather than one per character.
  function record(next: string) {
    if (next === last) return;
    if (burstFrom === null) burstFrom = last;
    last = next;
    clearTimeout(burstTimer);
    burstTimer = setTimeout(closeBurst, 400);
  }
  function closeBurst() {
    if (burstFrom === null) return;
    past = [...past, burstFrom].slice(-100);
    burstFrom = null;
    future = [];
  }
  function restore(json: string) {
    const [nextTitle, nextProblems, nextTime, nextScore, nextMessage, nextIcon, nextShade, nextOneAtATime] = JSON.parse(json);
    title = nextTitle;
    problems = nextProblems;
    timeLimitMinutes = nextTime;
    showScore = nextScore;
    passMessage = nextMessage;
    icon = nextIcon;
    shade = nextShade;
    // A draft written before this setting existed simply keeps the sheet view.
    oneAtATime = Boolean(nextOneAtATime);
    // Marking this as the newest state stops the restore being recorded as an edit.
    last = json;
    burstFrom = null;
    selected = new Set();
  }
  function undo() {
    clearTimeout(burstTimer);
    closeBurst(); // Anything still being typed becomes a step of its own first.
    if (!past.length) return;
    const target = past[past.length - 1];
    past = past.slice(0, -1);
    future = [last, ...future];
    restore(target);
  }
  function redo() {
    clearTimeout(burstTimer);
    closeBurst();
    if (!future.length) return;
    const target = future[0];
    future = future.slice(1);
    past = [...past, last];
    restore(target);
  }

  // ---- Keeping a draft through a reload ----
  // Everything unsaved lives only in this component, so a stray refresh used to
  // take it. The draft is keyed per quiz, and cleared the moment it matches what
  // is on the server or the quiz is saved.
  const draftKey = `fact-friends:quiz-draft:${classId}:${quiz?.id ?? "new"}`;
  let hydrated = false; // Nothing is written until any stored draft has been read.
  let restoredFrom = ""; // When set, a draft was recovered and can still be discarded.
  let draftTimer: ReturnType<typeof setTimeout> | undefined;

  $: if (hydrated) rememberDraft(state);

  function rememberDraft(next: string) {
    if (!browser) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try {
        if (next === savedState) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, JSON.stringify({ savedAt: new Date().toISOString(), state: next }));
      } catch (_) {
        // Storage can be full or switched off; the editor still works without it.
      }
    }, 400);
  }
  function forgetDraft() {
    if (!browser) return;
    try {
      localStorage.removeItem(draftKey);
    } catch (_) {}
  }
  // Throw the recovered changes away and go back to the saved quiz.
  function discardDraft() {
    forgetDraft();
    restore(savedState);
    past = [];
    future = [];
    restoredFrom = "";
  }
  // Keep the recovered changes, just stop saying so.
  function dismissDraftNotice() {
    restoredFrom = "";
  }

  onMount(() => {
    try {
      const stored = localStorage.getItem(draftKey);
      const draft = stored ? JSON.parse(stored) : null;
      // A draft matching the saved quiz is just noise, so it goes.
      if (typeof draft?.state === "string" && draft.state !== savedState) {
        restore(draft.state);
        restoredFrom = typeof draft.savedAt === "string" ? draft.savedAt : "";
      } else if (stored) {
        forgetDraft();
      }
    } catch (_) {
      forgetDraft();
    }
    hydrated = true;
  });

  function whenSaved(value: string): string {
    const when = new Date(value);
    if (!value || Number.isNaN(when.getTime())) return "earlier";
    return when.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  // ---- Editing a question in place ----
  function setOperand(id: string, key: "top" | "bottom", raw: string) {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 4);
    problems = problems.map((item) => (item.id === id ? { ...item, [key]: digits === "" ? 0 : Number(digits) } : item));
  }
  function setOperation(id: string, op: Operation) {
    problems = problems.map((item) => (item.id === id ? { ...item, op } : item));
  }
  // A new question copies the last one's operator, since a quiz usually carries
  // on in the same vein, and lands focused so it can be typed over immediately.
  async function addQuestion() {
    const op = problems.length ? problems[problems.length - 1].op : "multiplication";
    const fresh = makeProblem(op, 2, 2);
    problems = [...problems, fresh];
    selected = new Set();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const field = sheetGrid?.querySelector<HTMLInputElement>(`[data-operand="${fresh.id}-top"]`);
    field?.focus();
    field?.select();
  }

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
  // Clicking the card itself selects it, but not when the click landed on
  // something you meant to use — a number, the operator, the grip, the cross.
  function pickFromCard(id: string, index: number, event: MouseEvent) {
    if ((event.target as HTMLElement | null)?.closest("input, select, button")) return;
    pick(id, index, event);
  }
  function removeOne(id: string) {
    problems = problems.filter((item) => item.id !== id);
    if (selected.has(id)) { const next = new Set(selected); next.delete(id); selected = next; }
  }
  // Clearing out several at once is worth a second look; removing one is not.
  function removeSelected() {
    if (selected.size > 1 && !confirm(`Delete ${selected.size} questions from this quiz?`)) return;
    problems = problems.filter((item) => !selected.has(item.id));
    selected = new Set();
    anchor = null;
  }
  function selectAll() {
    selected = new Set(problems.map((item) => item.id));
  }
  // Escape clears a selection and Delete removes it, but never while a field has focus.
  function onKeydown(event: KeyboardEvent) {
    if (importOpen) return; // The import dialog owns the keyboard while it is up.
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
      event.preventDefault();
      exportPdf();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (event.key === "Escape" && exportOpen) { exportOpen = false; return; }
    if (event.key === "Escape") { selected = new Set(); return; }
    if ((event.key === "Delete" || event.key === "Backspace") && selected.size) {
      event.preventDefault();
      removeSelected();
    }
  }

  // The editor bar's backdrop-filter makes it the containing block for anything
  // fixed inside it, so a full-screen overlay only ever covers the bar itself and
  // clicks on the sheet below never reach it. Watch the document instead.
  //
  // Watch the whole wrapper, trigger included, rather than the popover alone: the
  // click that opened the popover is still on its way up to the document and
  // arrives after this listener is in place, so a popover that ignored its own
  // trigger's click would close again the instant it opened. Leaving the trigger
  // out of "outside" also lets its own handler do the toggling.
  function dismissOnOutsideClick(node: HTMLElement, close: () => void) {
    const wrap = node.parentElement ?? node;
    function handle(event: MouseEvent) {
      if (!wrap.contains(event.target as Node)) close();
    }
    document.addEventListener("click", handle);
    return { destroy: () => document.removeEventListener("click", handle) };
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

  function insertFamily(incoming: Problem[]) {
    problems = [...problems, ...incoming];
    pending = [];
  }
  // Reorders the questions for good — it edits the list rather than randomising
  // per student, so it lands on the undo stack like any other change.
  function shuffleQuestions() {
    const next = [...problems];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [next[index], next[swap]] = [next[swap], next[index]];
    }
    problems = next;
    selected = new Set();
  }
  function stepTime(delta: number) {
    timeLimitMinutes = Math.min(60, Math.max(1, timeLimitMinutes + delta));
  }
  // Exporting supersedes printing: the PDF is the same worksheet and carries the
  // quiz's data, so it can be imported back. A quiz has to exist to be exported.
  function exportPdf() {
    exportOpen = false;
    if (!editing || !quiz?.id) {
      pushToast("error", "Save this quiz before exporting it.", "The PDF is built from the saved quiz, so it needs saving first.");
      return;
    }
    window.location.href = `/api/quizzes/${quiz.id}/pdf`;
  }

  function quizMarkdown(): string {
    const heading = title.trim() || "Untitled quiz";
    const details = `${problems.length} question${problems.length === 1 ? "" : "s"} · ${timeLimitMinutes} minute${timeLimitMinutes === 1 ? "" : "s"}`;
    const questions = problems.map((problem, index) => `${index + 1}. ${problem.top} ${symbolFor(problem.op)} ${problem.bottom} = ____`);
    return [`# ${heading}`, "", details, "", ...questions].join("\n");
  }

  async function copyMarkdown() {
    exportOpen = false;
    try {
      await navigator.clipboard.writeText(quizMarkdown());
      pushToast("success", "Quiz copied as Markdown.", "You can paste it into a document, message, or notes app.");
    } catch (_) {
      pushToast("error", "The quiz could not be copied.", "Please allow clipboard access and try again.");
    }
  }

  // The same import dialog the library uses, held to a single quiz: its questions
  // join the quiz being written rather than being filed away as a quiz of their own.
  let importOpen = false;

  function addImportedQuestions(quiz: { title?: string; problems?: unknown }, source: string) {
    const incoming = readProblems(quiz.problems);
    if (!incoming.length) {
      pushToast("error", `${source} has no questions in it.`, "Nothing was added to this quiz.");
      return;
    }
    problems = [...problems, ...incoming];
    selected = new Set();
    pushToast("success", `Added ${incoming.length} question${incoming.length === 1 ? "" : "s"}${quiz.title ? ` from “${quiz.title}”` : ""}.`);
  }

  async function save() {
    if (!title.trim()) { titleInvalid = true; error = ""; titleInput?.focus(); return; }
    if (!problems.length) { error = "Add at least one question before saving."; return; }
    if (problems.length > 150) { error = "Keep the quiz to 150 questions or fewer."; return; }
    if (faults.size) { error = `Fix the highlighted question${faults.size === 1 ? "" : "s"}: ${[...faults.values()][0]}`; return; }
    saving = true; error = "";
    const data = { title: title.trim(), problems, timeLimitMinutes, showScore, oneAtATime, passMessage: passMessage.trim(), icon, shade };
    try {
      const response = editing
        ? await fetch(`/api/quizzes/${quiz?.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) })
        : await fetch("/api/quizzes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ class: classId, data }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      clearTimeout(draftTimer);
      forgetDraft();
      await goto(`/teacher/classes/${classId}/quizzes`);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "We could not save this quiz.";
      saving = false;
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

<!-- A PDF dropped or a quiz pasted anywhere in the editor adds its questions
     here, the same way it imports on the library screens. -->
<ImportDropTarget {classId} singleQuiz onImport={addImportedQuestions} bind:open={importOpen}>
<div class={`editor-screen ${sheetClass}`}>
  <header class="editor-bar editor-bar-quiz">
    <a class="editor-back" href={`/teacher/classes/${classId}/quizzes`}><Icon name="arrow-left" size={14} /> Quizzes</a>

    <div class="bar-title-row">
      <IconPicker {shade} name={icon} fallback="clipboard-list" compact title="Quiz icon and colour" onChange={(next) => { icon = next.name; shade = next.shade; }} />
      <input class="bar-title" class:invalid={titleInvalid} bind:this={titleInput} bind:value={title} placeholder="Untitled quiz" aria-label="Quiz name" aria-invalid={titleInvalid} spellcheck="false" />
    </div>

    <div class="bar-history">
      <button type="button" class="bar-icon-button" disabled={!canUndo} title="Undo" aria-label="Undo" on:click={undo}><Icon name="rotate-ccw" size={15} /></button>
      <button type="button" class="bar-icon-button" disabled={!canRedo} title="Redo" aria-label="Redo" on:click={redo}><Icon name="rotate-cw" size={15} /></button>
      <button type="button" class="bar-icon-button" disabled={problems.length < 2} title="Shuffle: put the questions in a random order" aria-label="Shuffle the questions" on:click={shuffleQuestions}>
        <Icon name="shuffle" size={15} />
      </button>
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

      <button
        type="button"
        class="bar-toggle"
        class:on={oneAtATime}
        role="switch"
        aria-checked={oneAtATime}
        title={oneAtATime ? "Students see one question at a time" : "Students see the whole sheet of questions"}
        on:click={() => (oneAtATime = !oneAtATime)}
      >
        <Icon name={oneAtATime ? "square" : "layout-grid"} size={14} /> {oneAtATime ? "One at a time" : "All at once"}
      </button>

      <div class="bar-popover-wrap">
        <button
          type="button"
          class="bar-icon-button"
          class:on={messageOpen}
          title="Finished message: the cheer students see when they finish"
          aria-label="Finished message"
          aria-expanded={messageOpen}
          aria-haspopup="dialog"
          on:click={() => (messageOpen = !messageOpen)}
        ><Icon name="smile" size={15} /></button>
        {#if messageOpen}
          <div class="bar-popover" role="dialog" aria-label="Finished message" use:dismissOnOutsideClick={() => (messageOpen = false)}>
            <p class="doc-note">The cheer students see when they finish this quiz.</p>
            <input class="doc-inline-input" bind:value={passMessage} placeholder="Great work! You finished this quiz." maxlength="120" />
          </div>
        {/if}
      </div>
    </div>

    <div class="editor-bar-actions">
      <button class="editor-ghost" type="button" title="Add the questions from a PDF to this quiz" on:click={() => (importOpen = true)}>
        <Icon name="download" size={15} /> Import
      </button>
      <div class="export-menu-wrap">
        <button class="editor-ghost export-trigger" type="button" aria-expanded={exportOpen} aria-haspopup="menu" on:click={() => (exportOpen = !exportOpen)}>
          <Icon name="upload" size={15} /> Export <Icon name="chevron-down" size={13} />
        </button>
        {#if exportOpen}
          <div class="export-dropdown" role="menu" aria-label="Export quiz" use:dismissOnOutsideClick={() => (exportOpen = false)}>
            <button type="button" role="menuitem" on:click={exportPdf}>
              <Icon name="download" size={15} />
              <span><strong>Export as PDF</strong><small>Download a printable worksheet</small></span>
            </button>
            <button type="button" role="menuitem" on:click={copyMarkdown}>
              <Icon name="copy" size={15} />
              <span><strong>Copy as Markdown</strong><small>Copy the questions as text</small></span>
            </button>
          </div>
        {/if}
      </div>
      <button class="editor-save" type="button" disabled={saving} on:click={save}>{saving ? "Saving…" : editing ? "Save changes" : "Save quiz"}</button>
    </div>
  </header>

  <div class="editor-body editor-body-picker">
    <div class="editor-side">
      <FactFamilyPicker onPreview={(next) => (pending = next)} onInsert={insertFamily} />
    </div>

    <div class="editor-canvas">
      <div class="doc-sheet">
        {#if restoredFrom}
          <div class="draft-note" role="status">
            <span>Unsaved changes from {whenSaved(restoredFrom)} were brought back.</span>
            <button type="button" on:click={discardDraft}>Discard them</button>
            <button type="button" class="draft-dismiss" aria-label="Dismiss this message" title="Keep the changes and hide this" on:click={dismissDraftNotice}><Icon name="x" size={14} /></button>
          </div>
        {/if}
        <div class="sheet-head">
          <p class="doc-eyebrow">Quiz</p>
          <p class="doc-summary">{problems.length} question{problems.length === 1 ? "" : "s"} · {timeLimitMinutes} min · {oneAtATime ? "one question at a time" : "all questions at once"} · {showScore ? "score shown" : "score hidden"} at the end</p>
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

        {#if problems.length || pending.length}
          <p class="sheet-hint">Click a number or the sign to change it · drag a question to move it · click a card to select, shift-click for a run</p>
          <ol class="sheet-grid" class:previewing={pending.length} bind:this={sheetGrid}>
            {#each problems as problem, index (problem.id)}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
              <li
                class="sheet-tile"
                class:selected={selected.has(problem.id)}
                class:dragging={dragIndex === index}
                class:faulty={faults.has(problem.id)}
                draggable="true"
                title={faults.get(problem.id) ?? ""}
                on:click={(event) => pickFromCard(problem.id, index, event)}
                on:dragstart={(event) => startDrag(index, event)}
                on:dragover={(event) => dragOver(index, event)}
                on:drop|preventDefault={() => (dragIndex = null)}
                on:dragend={() => (dragIndex = null)}
              >
                <span class="wp-num">{index + 1}</span>
                <div class="sheet-fields">
                  <input
                    class="sheet-operand"
                    data-operand={`${problem.id}-top`}
                    value={problem.top}
                    inputmode="numeric"
                    aria-label={`First number of question ${index + 1}`}
                    on:focus={(event) => event.currentTarget.select()}
                    on:input={(event) => setOperand(problem.id, "top", event.currentTarget.value)}
                  />
                  <select
                    class="sheet-op"
                    value={problem.op}
                    aria-label={`Operation for question ${index + 1}`}
                    on:change={(event) => setOperation(problem.id, event.currentTarget.value as Operation)}
                  >
                    {#each operations as op}<option value={op}>{symbolFor(op)}</option>{/each}
                  </select>
                  <input
                    class="sheet-operand"
                    value={problem.bottom}
                    inputmode="numeric"
                    aria-label={`Second number of question ${index + 1}`}
                    on:focus={(event) => event.currentTarget.select()}
                    on:input={(event) => setOperand(problem.id, "bottom", event.currentTarget.value)}
                  />
                  <i></i>
                </div>
                <button
                  type="button"
                  class="sheet-grip"
                  aria-label={`Move question ${index + 1} of ${problems.length}. Use the arrow keys.`}
                  on:keydown={(event) => nudge(index, event)}
                ><Icon name="grip-vertical" size={14} /></button>
                <button type="button" class="sheet-remove" aria-label={`Remove question ${index + 1}`} on:click={() => removeOne(problem.id)}><Icon name="x" size={12} /></button>
              </li>
            {/each}

            {#each pending as problem, index (problem.id)}
              <li class="sheet-tile pending">
                <span class="wp-num">{problems.length + index + 1}</span>
                <div class="sheet-fields">
                  <span class="sheet-operand-static">{problem.top}</span>
                  <span class="sheet-op-static">{symbolFor(problem.op)}</span>
                  <span class="sheet-operand-static">{problem.bottom}</span>
                  <i></i>
                </div>
              </li>
            {/each}

            {#if !pending.length}
              <li class="sheet-add">
                <button type="button" on:click={addQuestion}><Icon name="plus" size={16} /> Add question</button>
              </li>
            {/if}
          </ol>
        {:else}
          <button type="button" class="sheet-empty" on:click={addQuestion}>
            <Icon name="plus" size={22} />
            <strong>Add your first question</strong>
            <small>Write one here, or insert a whole fact family from the panel on the left.</small>
          </button>
        {/if}

        {#if error}<p class="doc-error">{error}</p>{/if}
      </div>
    </div>
  </div>

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
</ImportDropTarget>
