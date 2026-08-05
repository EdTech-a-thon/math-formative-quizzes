<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import {
    answerFor,
    buildFactSet,
    makeProblem,
    operationDetails,
    operations,
    problemProblem,
    symbolFor,
    type Operation,
    type Problem,
  } from "$lib/quizProblems";

  // The dialog never holds the quiz's questions — it hands new ones up and the
  // editor drops them in the bucket. Nothing links a question back to the fact
  // family that made it, so adding the same set twice adds it twice.
  export let onAdd: (problems: Problem[]) => void;
  export let onClose: () => void;

  let tab: "facts" | "custom" = "facts";
  let added = ""; // Confirmation after an add, since the dialog stays open for the next set.

  let factOp: Operation = "multiplication";
  let family = 2;
  let from = 1;
  let to = 12;

  let customOp: Operation = "multiplication";
  let customTop = 6;
  let customBottom = 7;

  $: familyChoices = Array.from(
    { length: operationDetails[factOp].max - operationDetails[factOp].min + 1 },
    (_, index) => operationDetails[factOp].min + index,
  );
  // Exactly the questions the Add button would drop into the quiz.
  $: preview = buildFactSet(factOp, family, from, to);
  $: customIssue = problemProblem(customOp, customTop, customBottom);
  $: customAnswer = customIssue ? null : answerFor({ op: customOp, top: customTop, bottom: customBottom });

  function pickFactOp(next: Operation) {
    if (next === factOp) return;
    factOp = next;
    // Keep the chosen family inside the new operation's range.
    family = Math.min(Math.max(family, operationDetails[next].min), operationDetails[next].max);
    from = operationDetails[next].factorMin;
    to = operationDetails[next].factorMax;
    added = "";
  }
  function changeRange(key: "from" | "to", value: number) {
    const bounded = Math.max(0, Math.min(12, Number.isFinite(value) ? value : 0));
    if (key === "from") from = bounded;
    else to = bounded;
    added = "";
  }
  function addFacts() {
    if (!preview.length) return;
    onAdd(preview);
    added = `Added ${preview.length} question${preview.length === 1 ? "" : "s"}.`;
  }
  function addCustom() {
    if (customIssue) return;
    onAdd([makeProblem(customOp, customTop, customBottom)]);
    added = "Added 1 question.";
  }
</script>

<svelte:window on:keydown={(event) => event.key === "Escape" && onClose()} />

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="add-backdrop" role="presentation" on:click={onClose}></div>
<div class="add-dialog" role="dialog" aria-modal="true" aria-label="Add questions">
  <div class="add-tabs" role="tablist">
    <button type="button" role="tab" aria-selected={tab === "facts"} class:on={tab === "facts"} on:click={() => { tab = "facts"; added = ""; }}>Math facts</button>
    <button type="button" role="tab" aria-selected={tab === "custom"} class:on={tab === "custom"} on:click={() => { tab = "custom"; added = ""; }}>Custom question</button>
    <button type="button" class="add-close" aria-label="Close" on:click={onClose}><Icon name="x" size={16} /></button>
  </div>

  {#if tab === "facts"}
    <div class="add-body op-{factOp}">
      <p class="add-label">Operation</p>
      <div class="op-pills">
        {#each operations as op}
          <button type="button" class="op-pill op-{op}" class:on={factOp === op} on:click={() => pickFactOp(op)}>
            <i>{symbolFor(op)}</i> {operationDetails[op].label}
          </button>
        {/each}
      </div>

      <p class="add-label">{operationDetails[factOp].verb}</p>
      <div class="add-family-grid">
        {#each familyChoices as choice}
          <button type="button" class="add-family" class:on={family === choice} aria-pressed={family === choice} on:click={() => { family = choice; added = ""; }}>{choice}</button>
        {/each}
      </div>

      <p class="add-label">Which facts</p>
      <div class="add-range">
        <span>from</span>
        <input type="number" min="0" max="12" value={from} aria-label="Lowest fact" on:input={(event) => changeRange("from", Number(event.currentTarget.value))} />
        <span>to</span>
        <input type="number" min="0" max="12" value={to} aria-label="Highest fact" on:input={(event) => changeRange("to", Number(event.currentTarget.value))} />
      </div>

      <div class="add-preview">
        <p class="add-preview-head">Adding {preview.length} question{preview.length === 1 ? "" : "s"}</p>
        <div class="add-preview-list">
          {#each preview.slice(0, 24) as problem (problem.id)}
            <span class="add-preview-chip">{problem.top} {symbolFor(problem.op)} {problem.bottom}</span>
          {/each}
          {#if preview.length > 24}<span class="add-preview-more">+{preview.length - 24} more</span>{/if}
        </div>
      </div>

      <div class="add-actions">
        {#if added}<p class="add-added" role="status">{added}</p>{/if}
        <button type="button" class="editor-ghost" on:click={onClose}>Done</button>
        <button type="button" class="editor-save" disabled={!preview.length} on:click={addFacts}>Add</button>
      </div>
    </div>
  {:else}
    <div class="add-body op-{customOp}">
      <p class="add-label">Operation</p>
      <div class="op-pills">
        {#each operations as op}
          <button type="button" class="op-pill op-{op}" class:on={customOp === op} on:click={() => { customOp = op; added = ""; }}>
            <i>{symbolFor(op)}</i> {operationDetails[op].label}
          </button>
        {/each}
      </div>

      <p class="add-label">The question</p>
      <div class="add-custom">
        <input type="number" bind:value={customTop} aria-label="First number" on:input={() => (added = "")} />
        <b>{symbolFor(customOp)}</b>
        <input type="number" bind:value={customBottom} aria-label="Second number" on:input={() => (added = "")} />
        <span class="add-equals">=</span>
        <span class="add-answer">{customAnswer ?? "?"}</span>
      </div>
      {#if customIssue}<p class="add-issue">{customIssue}</p>{/if}

      <div class="add-actions">
        {#if added}<p class="add-added" role="status">{added}</p>{/if}
        <button type="button" class="editor-ghost" on:click={onClose}>Done</button>
        <button type="button" class="editor-save" disabled={Boolean(customIssue)} on:click={addCustom}>Add</button>
      </div>
    </div>
  {/if}
</div>
