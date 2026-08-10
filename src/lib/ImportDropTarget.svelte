<script lang="ts">
  import ImportDialog from "$lib/ImportDialog.svelte";
  import type { Problem } from "$lib/quizProblems";

  export let classId: string;
  // Passed straight to the dialog: on the quiz editor one quiz comes in and is
  // handed back, rather than being filed away in the library.
  export let singleQuiz = false;
  export let onImport: (quiz: { title: string; problems: Problem[]; [key: string]: unknown }, source: string) => void = () => {};
  // Bindable, so a host with its own Import button opens the same dialog rather
  // than standing up a second one.
  export let open = false;

  let dragging = false;
  let droppedFiles: File[] = [];
  let pastedText = "";

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

  // A file can be dropped anywhere on the page, not only over the list, which
  // matters most when the list is empty and takes up hardly any of it.
  function dragOver(event: DragEvent) {
    if (open || !hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    dragging = true;
  }

  // Moving between elements fires dragleave, so only a pointer that has left the
  // page altogether — leaving nothing behind to move on to — counts as leaving.
  function dragLeave(event: DragEvent) {
    if (!document.body.contains(event.relatedTarget as Node | null)) dragging = false;
  }

  function drop(event: DragEvent) {
    if (open || !hasFiles(event)) return;
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

<svelte:window on:paste={paste} on:dragover={dragOver} on:dragleave={dragLeave} on:drop={drop} />

<slot />

{#if dragging}
  <div class="import-page-overlay" aria-hidden="true">
    <strong>{singleQuiz ? "Drop to add questions" : "Drop to import"}</strong>
    <span>Quiz or progression PDF</span>
  </div>
{/if}

{#if open}
  <ImportDialog {classId} {singleQuiz} {onImport} initialFiles={droppedFiles} initialText={pastedText} onClose={close} />
{/if}
