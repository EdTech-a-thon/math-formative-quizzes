<script lang="ts">
  import { goto } from "$app/navigation";
  import QuizPreview from "$lib/QuizPreview.svelte";
  import Icon from "$lib/Icon.svelte";
  import { buildProblems, groupCount, type FactGroup, type Operation } from "$lib/quizProblems";

  type QuizData = { title: string; operation: Operation; factGroups: FactGroup[]; questionCount: number; timeLimitMinutes: number; showScore: boolean; passMessage: string };

  export let classId: string;
  export let quiz: { id: string; data: Partial<QuizData> } | null = null;

  // `min`/`max` bound the fact family (the number you operate BY); `factorMin`/
  // `factorMax` bound the second operand a new group ranges over by default.
  const details: Record<Operation, { label: string; symbol: string; verb: string; min: number; max: number; factorMin: number; factorMax: number }> = {
    multiplication: { label: "Multiplication", symbol: "×", verb: "Multiply by", min: 0, max: 12, factorMin: 1, factorMax: 12 },
    division: { label: "Division", symbol: "÷", verb: "Divide by", min: 1, max: 12, factorMin: 1, factorMax: 12 },
    addition: { label: "Addition", symbol: "+", verb: "Add", min: 0, max: 20, factorMin: 1, factorMax: 12 },
    subtraction: { label: "Subtraction", symbol: "−", verb: "Subtract", min: 0, max: 9, factorMin: 1, factorMax: 12 },
  };

  const editing = Boolean(quiz?.id);
  // Remembers a family's range after it's deselected, keyed by operation+group,
  // so an accidental deselect/reselect restores what the teacher had set.
  const rememberedRanges: Record<string, { from: number; to: number }> = {};
  const rangeKey = (op: Operation, group: number) => `${op}:${group}`;
  let title = quiz?.data?.title ?? "";
  let operation: Operation = (quiz?.data?.operation as Operation) ?? "multiplication";
  let groups: FactGroup[] = quiz?.data?.factGroups?.length
    ? quiz.data.factGroups.map((item) => ({ group: item.group, from: item.from ?? 1, to: item.to ?? item.questions ?? 12 }))
    : [defaultGroup("multiplication", 5)];
  let timeLimitMinutes = quiz?.data?.timeLimitMinutes ?? 2;
  let showScore = quiz?.data?.showScore ?? true;
  let passMessage = quiz?.data?.passMessage ?? "Great work! You finished this quiz.";
  let seed: number | null = null; // Non-null once the teacher shuffles; drives preview + print order.
  let hoverGroup: number | null = null; // Fact family the pointer is over.
  let focusGroup: number | null = null; // Fact family whose range input is focused.
  // Either hovering or editing a selected card lights up its questions; focus wins so the
  // highlight stays while typing even if the pointer wanders off the card.
  $: highlightGroup = focusGroup ?? hoverGroup;
  let error = "";
  let saving = false;
  let titleInvalid = false; // Set when a save is attempted with no name; clears as soon as one is typed.
  let titleInput: HTMLInputElement | undefined;
  $: if (title.trim()) titleInvalid = false;

  $: total = groups.reduce((sum, item) => sum + groupCount(item), 0);
  $: range = Array.from({ length: details[operation].max - details[operation].min + 1 }, (_, index) => details[operation].min + index);
  // The full worksheet for printing — every question, in the order currently shown.
  $: printProblems = buildProblems(operation, groups, { seed });

  function defaultGroup(op: Operation, group: number): FactGroup {
    const remembered = rememberedRanges[rangeKey(op, group)];
    return { group, from: remembered?.from ?? details[op].factorMin, to: remembered?.to ?? details[op].factorMax };
  }
  function pickOperation(next: Operation) {
    if (next === operation) return;
    operation = next;
    // Reset to a sensible starting fact for the new operation's range.
    groups = [defaultGroup(next, details[next].min + (next === "multiplication" ? 5 : 2))];
  }
  function toggleGroup(group: number) {
    const existing = groups.find((item) => item.group === group);
    if (existing) {
      rememberedRanges[rangeKey(operation, group)] = { from: existing.from, to: existing.to };
      groups = groups.filter((item) => item.group !== group);
      if (hoverGroup === group) hoverGroup = null;
    } else {
      groups = [...groups, defaultGroup(operation, group)].sort((a, b) => a.group - b.group);
      hoverGroup = group; // Pointer is already over the card; light it up now without waiting for re-entry.
    }
  }
  function changeRange(group: number, key: "from" | "to", value: number) {
    const bounded = Math.max(0, Math.min(12, Number.isFinite(value) ? value : 0));
    groups = groups.map((item) => (item.group === group ? { ...item, [key]: bounded } : item));
  }
  function stepTime(delta: number) {
    timeLimitMinutes = Math.min(60, Math.max(1, timeLimitMinutes + delta));
  }
  function shuffleQuestions() {
    seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  }
  function resetOrder() {
    seed = null; // Back to fact-card order.
  }
  function printWorksheet() {
    if (typeof window !== "undefined") window.print();
  }

  async function save() {
    if (!title.trim()) { titleInvalid = true; error = ""; titleInput?.focus(); return; }
    if (!groups.length) { error = "Choose at least one fact group to practice."; return; }
    if (total > 150) { error = "Keep the quiz to 150 questions or fewer."; return; }
    saving = true; error = "";
    const data = { title: title.trim(), operation, factGroups: groups, questionCount: total, timeLimitMinutes, showScore, passMessage: passMessage.trim() };
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

<div class="editor-screen op-{operation}">
  <header class="editor-bar">
    <a class="editor-back" href={`/teacher/classes/${classId}/quizzes`}><Icon name="arrow-left" size={14} /> Quizzes</a>
    <span class="editor-crumb">{editing ? "Editing quiz" : "New quiz"}</span>
    <div class="editor-bar-actions">
      <button class="editor-ghost" type="button" on:click={shuffleQuestions}><Icon name="shuffle" size={15} /> Shuffle</button>
      {#if seed != null}<button class="editor-ghost" type="button" on:click={resetOrder}><Icon name="rotate-ccw" size={15} /> Reset order</button>{/if}
      <button class="editor-ghost" type="button" on:click={printWorksheet}><Icon name="printer" size={15} /> Print</button>
      <a class="editor-cancel" href={`/teacher/classes/${classId}/quizzes`}>Cancel</a>
      <button class="editor-save" type="button" disabled={saving} on:click={save}>{saving ? "Saving…" : editing ? "Save changes" : "Save quiz"}</button>
    </div>
  </header>

  <div class="editor-body">
    <div class="editor-canvas">
      <div class="doc-sheet">
        <p class="doc-eyebrow">{details[operation].label} quiz</p>
        <input class="doc-title" class:invalid={titleInvalid} bind:this={titleInput} bind:value={title} placeholder="Untitled quiz" aria-label="Quiz name" aria-invalid={titleInvalid} spellcheck="false" />
        {#if titleInvalid}<p class="doc-title-error" role="alert">Give your quiz a name before saving.</p>{/if}
        <p class="doc-summary">{total} question{total === 1 ? "" : "s"} · about {Math.max(1, Math.round(timeLimitMinutes))} min · {showScore ? "score shown" : "score hidden"} at the end{#if seed != null} · shuffled{/if}</p>

        <section class="doc-block">
          <h2 class="doc-heading">What are they practicing?</h2>
          <div class="op-pills">
            {#each Object.entries(details) as [id, item]}
              <button type="button" class="op-pill op-{id}" class:on={operation === id} on:click={() => pickOperation(id as Operation)}><i>{item.symbol}</i> {item.label}</button>
            {/each}
          </div>
        </section>

        <section class="doc-block">
          <h2 class="doc-heading">{details[operation].verb} —<span class="doc-hint">tap a fact family, then set which facts it covers · hover a card to see its questions</span></h2>
          <div class="fact-grid">
            {#each range as group}
              {@const selected = groups.find((item) => item.group === group)}
              <div
                class="fact-chip"
                class:on={selected}
                class:lit={highlightGroup === group && selected}
                role="group"
                on:pointerenter={() => { if (selected) hoverGroup = group; }}
                on:pointerleave={() => { if (hoverGroup === group) hoverGroup = null; }}
                on:focusin={(event) => { if (selected && (event.target as HTMLElement).tagName === "INPUT") focusGroup = group; }}
                on:focusout={(event) => { if ((event.target as HTMLElement).tagName === "INPUT" && focusGroup === group) focusGroup = null; }}
              >
                <button type="button" class="fact-toggle" on:click={() => toggleGroup(group)} aria-pressed={Boolean(selected)}>{group}</button>
                {#if selected}
                  <div class="fact-range">
                    <span class="fact-range-op">{details[operation].symbol}</span>
                    <input class="fact-range-input" type="number" min="0" max="12" value={selected.from} aria-label={`Lowest fact for ${group}`} on:input={(event) => changeRange(group, "from", Number(event.currentTarget.value))} />
                    <span class="fact-range-dash">–</span>
                    <input class="fact-range-input" type="number" min="0" max="12" value={selected.to} aria-label={`Highest fact for ${group}`} on:input={(event) => changeRange(group, "to", Number(event.currentTarget.value))} />
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </section>

        <section class="doc-block doc-inline-rows">
          <div class="doc-row">
            <div><h2 class="doc-heading">Time limit</h2><p class="doc-note">How long learners have to finish.</p></div>
            <div class="stepper"><button type="button" on:click={() => stepTime(-1)} aria-label="Less time"><Icon name="minus" size={17} /></button><b>{timeLimitMinutes}<small>min</small></b><button type="button" on:click={() => stepTime(1)} aria-label="More time"><Icon name="plus" size={17} /></button></div>
          </div>
          <div class="doc-row">
            <div><h2 class="doc-heading">Show their score</h2><p class="doc-note">Reveal the number correct on the finished screen.</p></div>
            <button type="button" class="switch" class:on={showScore} role="switch" aria-checked={showScore} aria-label="Show their score" on:click={() => (showScore = !showScore)}><span></span></button>
          </div>
          <div class="doc-row doc-row-stacked">
            <div><h2 class="doc-heading">Finished message</h2><p class="doc-note">The cheer students see when they complete the quiz.</p></div>
            <input class="doc-inline-input" bind:value={passMessage} placeholder="Great work! You finished this quiz." maxlength="120" />
          </div>
        </section>

        {#if error}<p class="doc-error">{error}</p>{/if}
      </div>
    </div>

    <div class="editor-aside">
      <QuizPreview {title} {operation} factGroups={groups} questionCount={total} {timeLimitMinutes} {showScore} {seed} {passMessage} {highlightGroup} />
    </div>
  </div>

  <div class="print-sheet">
    <div class="print-head">
      <h1>{title.trim() || "Untitled quiz"}</h1>
      <div class="print-meta"><span>Name: ____________________</span><span>Date: ____________</span><span>{Math.max(1, Math.round(timeLimitMinutes))} min · {total} questions</span></div>
    </div>
    <ol class="print-grid">
      {#each printProblems as problem, index}
        <li class="print-problem"><span class="pp-num">{index + 1}.</span><div class="pp-stack"><b>{problem.top}</b><b>{problem.sym} {problem.bottom}</b><i></i><span class="pp-answer"></span></div></li>
      {/each}
    </ol>
  </div>
</div>
