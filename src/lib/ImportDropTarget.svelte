<script lang="ts">
  import ImportDialog from "$lib/ImportDialog.svelte";

  export let classId: string;

  let dragging = false;
  let open = false;
  let droppedFiles: File[] = [];
  let target: HTMLDivElement;

  function hasFiles(event: DragEvent) {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files");
  }

  function dragOver(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    dragging = true;
  }

  function dragLeave(event: DragEvent) {
    if (!target.contains(event.relatedTarget as Node | null)) dragging = false;
  }

  function drop(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragging = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!files.length) return;
    droppedFiles = files;
    open = true;
  }

  function close() {
    open = false;
    droppedFiles = [];
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="import-page-target" bind:this={target} on:dragover={dragOver} on:dragleave={dragLeave} on:drop={drop}>
  <slot />
  {#if dragging}
    <div class="import-page-overlay" aria-hidden="true">
      <strong>Drop to import</strong>
      <span>Quiz or progression PDF</span>
    </div>
  {/if}
</div>

{#if open}
  <ImportDialog {classId} initialFiles={droppedFiles} onClose={close} />
{/if}
