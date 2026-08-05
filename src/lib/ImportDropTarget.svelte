<script lang="ts">
  import ImportDialog from "$lib/ImportDialog.svelte";

  export let classId: string;

  let dragging = false;
  let open = false;
  let droppedFiles: File[] = [];
  let pastedText = "";
  let target: HTMLDivElement;

  function looksImportable(text: string) {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
      const raw = parsed as Record<string, unknown>;
      const value = raw.kind === "quiz" ? raw.quiz : raw.kind === "progression" ? raw.progression : raw.quiz ?? raw.progression ?? raw;
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const record = value as Record<string, unknown>;
      if (Array.isArray(record.problems) && record.problems.length > 0) return true;
      return Array.isArray(record.quizzes) && record.quizzes.some((quiz) => {
        if (!quiz || typeof quiz !== "object" || Array.isArray(quiz)) return false;
        return Array.isArray((quiz as Record<string, unknown>).problems) && ((quiz as Record<string, unknown>).problems as unknown[]).length > 0;
      });
    } catch (_) {
      return false;
    }
  }

  function paste(event: ClipboardEvent) {
    if (open || (event.target as HTMLElement | null)?.closest("input, textarea, [contenteditable]")) return;
    const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
    if (!looksImportable(text)) return;
    event.preventDefault();
    droppedFiles = [];
    pastedText = text;
    open = true;
  }

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
    pastedText = "";
    open = true;
  }

  function close() {
    open = false;
    droppedFiles = [];
    pastedText = "";
  }
</script>

<svelte:window on:paste={paste} />

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
  <ImportDialog {classId} initialFiles={droppedFiles} initialText={pastedText} onClose={close} />
{/if}
