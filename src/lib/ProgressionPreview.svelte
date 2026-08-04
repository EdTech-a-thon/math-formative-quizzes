<script lang="ts">
  import Icon from "$lib/Icon.svelte";

  type Step = { id: string; title: string; operation: string; questionCount: number };

  export let name = "";
  export let description = "";
  export let passPercentage = 80;
  export let steps: Step[] = [];
  // Called with the full list of quiz ids in their new order.
  export let onReorder: (ids: string[]) => void = () => {};
  export let onRemove: (id: string) => void = () => {};

  const symbols: Record<string, string> = { multiplication: "×", division: "÷", addition: "+", subtraction: "−" };

  let dragIndex: number | null = null; // Which step is being dragged right now.

  function move(from: number, to: number) {
    if (to < 0 || to >= steps.length || from === to) return;
    const ids = steps.map((step) => step.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    onReorder(ids);
  }
  function startDrag(index: number, event: DragEvent) {
    dragIndex = index;
    event.dataTransfer?.setData("text/plain", steps[index].id); // Firefox needs some payload to start a drag.
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }
  // Reorder as the pointer passes over a neighbour, so the list previews the drop.
  function dragOver(index: number, event: DragEvent) {
    event.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    move(dragIndex, index);
    dragIndex = index;
  }
  // Arrow keys move a step without a mouse; the grip button keeps focus as it travels.
  function nudge(index: number, event: KeyboardEvent) {
    const delta = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!delta) return;
    event.preventDefault();
    move(index, index + delta);
  }
</script>

<aside class="qp path-preview" aria-label="Progression preview">
  <div class="qp-frame-label"><span><Icon name="circle-dot" size={12} /></span> Live path preview</div>

  <div class="qp-phone">
    <div class="qp-notch"></div>
    <div class="qp-screen">
      <header class="path-head">
        <strong>{name.trim() || "Untitled path"}</strong>
        {#if description.trim()}<p>{description}</p>{/if}
        <span class="path-badge">{passPercentage}% to pass each step</span>
      </header>

      {#if steps.length}
        <ol class="path-list">
          {#each steps as step, index (step.id)}
            <li
              class="path-step op-{step.operation}"
              class:dragging={dragIndex === index}
              draggable="true"
              on:dragstart={(event) => startDrag(index, event)}
              on:dragover={(event) => dragOver(index, event)}
              on:drop|preventDefault={() => (dragIndex = null)}
              on:dragend={() => (dragIndex = null)}
            >
              <span class="path-num">{index + 1}</span>
              <div class="path-info">
                <strong>{step.title}</strong>
                <small>{symbols[step.operation] ?? ""} {step.operation} · {step.questionCount} questions</small>
              </div>
              <span class="path-state">
                {#if index === 0}<em>Open</em>{:else}<Icon name="lock" size={13} />{/if}
              </span>
              <button
                type="button"
                class="path-grip"
                aria-label={`Move ${step.title} — step ${index + 1} of ${steps.length}. Use the up and down arrow keys.`}
                on:keydown={(event) => nudge(index, event)}
              ><Icon name="grip-vertical" size={15} /></button>
              <button type="button" class="path-remove" aria-label={`Remove ${step.title} from the path`} on:click={() => onRemove(step.id)}><Icon name="x" size={13} /></button>
            </li>
          {/each}
        </ol>
      {:else}
        <div class="qp-empty-problem">Tick a quiz on the left and it lands here as the next step.</div>
      {/if}
    </div>
  </div>

  <p class="qp-foot">Drag a step to move it — learners work through the path top to bottom.</p>
</aside>
