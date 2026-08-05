<script lang="ts">
  import { buildFactSet, operationDetails, operations, symbolFor, type Operation, type Problem } from "$lib/quizProblems";

  // The panel never shows its own preview. It reports the questions it would
  // insert, and the editor shows them in the quiz itself, highlighted, so you
  // see them in place before committing.
  export let onPreview: (problems: Problem[]) => void;
  export let onInsert: (problems: Problem[]) => void;

  let factOp: Operation = "multiplication";
  let family = 2;
  let from = 1;
  let to = 12;
  // The panel is always on screen, so it stays quiet until it is actually used
  // and goes quiet again after an insert — otherwise every quiz would open with
  // a dozen questions it never asked to see.
  let armed = false;

  $: familyChoices = Array.from(
    { length: operationDetails[factOp].max - operationDetails[factOp].min + 1 },
    (_, index) => operationDetails[factOp].min + index,
  );
  $: preview = buildFactSet(factOp, family, from, to);
  $: onPreview(armed ? preview : []);

  function pickOperation(next: Operation) {
    armed = true;
    if (next === factOp) return;
    factOp = next;
    // Keep the chosen family inside the new operation's range.
    family = Math.min(Math.max(family, operationDetails[next].min), operationDetails[next].max);
    from = operationDetails[next].factorMin;
    to = operationDetails[next].factorMax;
  }
  function pickFamily(choice: number) {
    armed = true;
    family = choice;
  }
  function changeRange(key: "from" | "to", value: number) {
    armed = true;
    const bounded = Math.max(0, Math.min(12, Number.isFinite(value) ? value : 0));
    if (key === "from") from = bounded;
    else to = bounded;
  }
  function insert() {
    onInsert(preview);
    armed = false; // The questions are real now, so stop ghosting them.
  }
</script>

<aside class="ff-panel op-{factOp}" aria-label="Insert a fact family">
  <h2 class="ff-title">Insert a fact family</h2>

  <p class="ff-label">Operation</p>
  <div class="op-pills">
    {#each operations as op}
      <button type="button" class="op-pill op-{op}" class:on={factOp === op} on:click={() => pickOperation(op)}>
        <i>{symbolFor(op)}</i> {operationDetails[op].label}
      </button>
    {/each}
  </div>

  <p class="ff-label">{operationDetails[factOp].verb}</p>
  <div class="ff-family-grid">
    {#each familyChoices as choice}
      <button type="button" class="ff-family" class:on={armed && family === choice} aria-pressed={armed && family === choice} on:click={() => pickFamily(choice)}>{choice}</button>
    {/each}
  </div>

  <p class="ff-label">Which facts</p>
  <div class="ff-range">
    <span>from</span>
    <input type="number" min="0" max="12" value={from} aria-label="Lowest fact" on:input={(event) => changeRange("from", Number(event.currentTarget.value))} />
    <span>to</span>
    <input type="number" min="0" max="12" value={to} aria-label="Highest fact" on:input={(event) => changeRange("to", Number(event.currentTarget.value))} />
  </div>

  <div class="ff-actions">
    {#if armed}
      <p class="ff-count">{preview.length} question{preview.length === 1 ? "" : "s"} shown below</p>
      <button type="button" class="editor-save ff-insert" disabled={!preview.length} on:click={insert}>Insert</button>
    {:else}
      <p class="ff-idle">Pick a fact family to see it in the quiz.</p>
    {/if}
  </div>
</aside>
