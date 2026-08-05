<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import Icon from "$lib/Icon.svelte";
  import { pushToast } from "$lib/toasts";
  import type { Problem } from "$lib/quizProblems";

  export let classId: string;
  export let onClose: () => void;

  type QuizRecord = { title: string; problems: Problem[]; [key: string]: unknown };
  type ProgressionRecord = { name: string; quizzes: QuizRecord[]; passPercentage: number; [key: string]: unknown };
  type ImportItem = { kind: "progression"; progression: ProgressionRecord } | { kind: "quiz"; quiz: QuizRecord };
  // One bundle per thing added. Everything arrives ticked; the point of the list
  // is to let things be unticked before any of it exists.
  type Staged = {
    id: number;
    source: string;
    kind: "quiz" | "progression";
    name: string;
    keepProgression: boolean; // Whether to build the path, or just take its quizzes loose.
    quizzes: { id: number; title: string; count: number; keep: boolean; record: QuizRecord }[];
    progression: ProgressionRecord | null;
  };

  let staged: Staged[] = [];
  let dragging = false;
  let reading = false;
  let importing = false;
  let fileInput: HTMLInputElement;
  let nextId = 0;

  $: chosenQuizzes = staged.flatMap((item) => item.quizzes.filter((quiz) => quiz.keep));
  $: chosenPaths = staged.filter((item) => item.kind === "progression" && item.keepProgression && item.quizzes.some((quiz) => quiz.keep));
  $: canImport = chosenQuizzes.length > 0 && !importing;
  // Built here rather than in the markup: Svelte trims whitespace around block
  // tags, which was running the two counts together.
  $: summary = !staged.length
    ? "Nothing added yet"
    : !chosenQuizzes.length
      ? "Nothing selected"
      : `${[describe(chosenQuizzes.length, "quiz", "quizzes"), chosenPaths.length ? describe(chosenPaths.length, "progression", "progressions") : ""]
          .filter(Boolean)
          .join(" and ")} selected`;

  function describe(count: number, one: string, many: string) {
    return `${count} ${count === 1 ? one : many}`;
  }

  function stage(parsed: { kind: string; quiz?: QuizRecord; progression?: ProgressionRecord }, source: string) {
    nextId += 1;
    if (parsed.kind === "progression" && parsed.progression) {
      const progression = parsed.progression;
      staged = [
        ...staged,
        {
          id: nextId,
          source,
          kind: "progression",
          name: progression.name,
          keepProgression: true,
          progression,
          quizzes: progression.quizzes.map((quiz, index) => ({
            id: index,
            title: quiz.title,
            count: quiz.problems.length,
            keep: true,
            record: quiz,
          })),
        },
      ];
      return;
    }
    if (!parsed.quiz) return;
    staged = [
      ...staged,
      {
        id: nextId,
        source,
        kind: "quiz",
        name: parsed.quiz.title,
        keepProgression: false,
        progression: null,
        quizzes: [{ id: 0, title: parsed.quiz.title, count: parsed.quiz.problems.length, keep: true, record: parsed.quiz }],
      },
    ];
  }

  // Everything added goes through the server, so what is listed is exactly what
  // the server understood — not a second guess made in the browser.
  async function read(body: FormData, source: string) {
    reading = true;
    try {
      const response = await fetch("/api/import/read", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast("error", result.message || `We could not read ${source}.`, result.detail || "Please try again.");
        return false;
      }
      stage(result, source);
      return true;
    } catch (caught) {
      pushToast("error", `We could not read ${source}.`, caught instanceof Error && caught.message ? caught.message : "Check your connection and try again.");
      return false;
    } finally {
      reading = false;
    }
  }

  async function addFiles(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      const body = new FormData();
      body.append("file", file);
      await read(body, file.name);
    }
    if (fileInput) fileInput.value = "";
  }

  // Paste anywhere while the dialog is open. A copied file comes through as one;
  // anything else is taken as text and read the same way a file would be.
  function onPaste(event: ClipboardEvent) {
    if ((event.target as HTMLElement | null)?.closest("input, textarea, [contenteditable]")) return;

    const files = event.clipboardData?.files;
    if (files?.length) {
      event.preventDefault();
      addFiles(files);
      return;
    }
    const text = event.clipboardData?.getData("text/plain")?.trim();
    if (!text) return;
    event.preventDefault();
    const body = new FormData();
    body.append("text", text);
    read(body, "pasted text");
  }

  function onDrop(event: DragEvent) {
    dragging = false;
    addFiles(event.dataTransfer?.files ?? null);
  }
  function removeStaged(id: number) {
    staged = staged.filter((item) => item.id !== id);
  }
  function toggleQuiz(itemId: number, quizId: number) {
    staged = staged.map((item) =>
      item.id === itemId
        ? { ...item, quizzes: item.quizzes.map((quiz) => (quiz.id === quizId ? { ...quiz, keep: !quiz.keep } : quiz)) }
        : item,
    );
  }
  function togglePath(itemId: number) {
    staged = staged.map((item) => (item.id === itemId ? { ...item, keepProgression: !item.keepProgression } : item));
  }

  async function commit() {
    importing = true;
    try {
      // A path is rebuilt from only the quizzes still ticked, in their original
      // order. Untick the path itself and its quizzes still come in, just loose.
      const items: ImportItem[] = staged.flatMap((item): ImportItem[] => {
        const kept = item.quizzes.filter((quiz) => quiz.keep);
        if (!kept.length) return [];
        if (item.kind === "progression" && item.keepProgression && item.progression) {
          return [{ kind: "progression", progression: { ...item.progression, quizzes: kept.map((quiz) => quiz.record) } }];
        }
        return kept.map((quiz) => ({ kind: "quiz", quiz: quiz.record }));
      });

      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class: classId, items }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast("error", result.message || "We could not finish that import.", result.detail || "");
        return;
      }
      const parts = [describe(result.quizzes, "quiz", "quizzes")];
      if (result.progressions) parts.push(describe(result.progressions, "progression", "progressions"));
      pushToast("success", `Imported ${parts.join(" and ")}.`);
      await invalidateAll();
      onClose();
    } catch (caught) {
      pushToast("error", "We could not finish that import.", caught instanceof Error && caught.message ? caught.message : "Check your connection and try again.");
    } finally {
      importing = false;
    }
  }
</script>

<svelte:window on:keydown={(event) => event.key === "Escape" && !importing && onClose()} on:paste={onPaste} />

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-backdrop" role="presentation" on:click={() => !importing && onClose()}></div>
<div class="import-dialog" role="dialog" aria-modal="true" aria-label="Import quizzes">
  <header class="import-head">
    <h2>Import</h2>
    <button type="button" class="modal-close" aria-label="Close" on:click={onClose}><Icon name="x" size={16} /></button>
  </header>

  <div class="import-body">
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="import-drop"
      class:on={dragging}
      role="presentation"
      on:dragover|preventDefault={() => (dragging = true)}
      on:dragleave={() => (dragging = false)}
      on:drop|preventDefault={onDrop}
    >
      <Icon name="download" size={22} />
      <strong>Drop a PDF here</strong>
      <button type="button" class="ghost-btn" disabled={reading} on:click={() => fileInput.click()}>
        {reading ? "Reading…" : "Choose a file"}
      </button>
      <small>Drop several at once, or paste a copied quiz.</small>
      <input class="sr-only" type="file" multiple accept="application/pdf,.pdf,application/json,.json" bind:this={fileInput} on:change={() => addFiles(fileInput.files)} />
    </div>

    {#if staged.length}
      <div class="import-list">
        <p class="import-list-head">Ready to import</p>
        {#each staged as item (item.id)}
          <div class="import-item">
            <div class="import-item-head">
              <span class="import-kind">{item.kind === "progression" ? "Progression" : "Quiz"}</span>
              <strong>{item.name}</strong>
              <small>from {item.source}</small>
              <button type="button" class="import-drop-item" aria-label={`Remove ${item.name}`} on:click={() => removeStaged(item.id)}><Icon name="x" size={13} /></button>
            </div>

            {#if item.kind === "progression"}
              <label class="import-check import-path-check">
                <input type="checkbox" checked={item.keepProgression} on:change={() => togglePath(item.id)} />
                <span>Build the progression itself{item.keepProgression ? "" : " — its quizzes will come in on their own"}</span>
              </label>
            {/if}

            <div class="import-quizzes">
              {#each item.quizzes as quiz (quiz.id)}
                <label class="import-check">
                  <input type="checkbox" checked={quiz.keep} on:change={() => toggleQuiz(item.id, quiz.id)} />
                  <span>{quiz.title}</span>
                  <em>{describe(quiz.count, "question", "questions")}</em>
                </label>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <footer class="import-actions">
    <p class="import-summary">{summary}</p>
    <button type="button" class="editor-ghost" disabled={importing} on:click={onClose}>Cancel</button>
    <button type="button" class="editor-save" disabled={!canImport} on:click={commit}>{importing ? "Importing…" : "Import"}</button>
  </footer>
</div>
