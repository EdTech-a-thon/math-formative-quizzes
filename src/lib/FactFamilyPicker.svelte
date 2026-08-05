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

  const RANGE_MAX = 12;
  const ticks = Array.from({ length: RANGE_MAX + 1 }, (_, index) => index);
  // Either handle can be dragged past the other; the line just reads whichever
  // way round they end up, so nothing gets stuck.
  $: low = Math.min(from, to);
  $: high = Math.max(from, to);

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
    const bounded = Math.max(0, Math.min(RANGE_MAX, Number.isFinite(value) ? value : 0));
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

  <p class="ff-label">Which facts <span class="ff-readout">{symbolFor(factOp)}{from} to {symbolFor(factOp)}{to}</span></p>
  <!-- Two sliders sharing one track. Only the thumbs take the pointer, so each
       handle is grabbable, and each is a real range input so arrow keys work. -->
  <div class="ff-line">
    <div class="ff-line-track"><span class="ff-line-fill" style={`left: ${(low / RANGE_MAX) * 100}%; right: ${100 - (high / RANGE_MAX) * 100}%`}></span></div>
    <input
      class="ff-line-input"
      class:lift={to >= RANGE_MAX}
      type="range" min="0" max={RANGE_MAX} step="1" value={from}
      aria-label="Lowest fact"
      on:input={(event) => changeRange("from", Number(event.currentTarget.value))}
    />
    <input
      class="ff-line-input"
      type="range" min="0" max={RANGE_MAX} step="1" value={to}
      aria-label="Highest fact"
      on:input={(event) => changeRange("to", Number(event.currentTarget.value))}
    />
    <div class="ff-line-ticks" aria-hidden="true">
      {#each ticks as tick}<span class:on={tick >= low && tick <= high}>{tick}</span>{/each}
    </div>
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
