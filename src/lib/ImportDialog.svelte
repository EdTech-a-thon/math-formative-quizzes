<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { onMount } from "svelte";
  import Icon from "$lib/Icon.svelte";
  import { pushToast } from "$lib/toasts";
  import type { Problem } from "$lib/quizProblems";

  export let classId: string;
  export let onClose: () => void;
  export let initialFiles: File[] = [];
  export let initialText = "";
  // Adding questions to a quiz already open in the editor, rather than filing new
  // quizzes away in the library: one quiz comes in, and it is handed straight back
  // through onImport instead of being created here.
  export let singleQuiz = false;
  export let onImport: (quiz: QuizRecord, source: string) => void = () => {};

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
      : singleQuiz
        ? `${describe(chosenQuizzes[0].count, "question", "questions")} ready to add`
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
      const path: Staged = {
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
          // A progression is welcome even when only one quiz can come out of it:
          // its quizzes become a choice of one, starting on the first step.
          keep: singleQuiz ? index === 0 : true,
          record: quiz,
        })),
      };
      staged = singleQuiz ? [path] : [...staged, path];
      return;
    }
    if (!parsed.quiz) return;
    const item: Staged = {
      id: nextId,
      source,
      kind: "quiz",
      name: parsed.quiz.title,
      keepProgression: false,
      progression: null,
      quizzes: [{ id: 0, title: parsed.quiz.title, count: parsed.quiz.problems.length, keep: true, record: parsed.quiz }],
    };
    // Only one quiz can be added to the quiz being edited, so a second one takes
    // the place of the first rather than queueing behind it.
    staged = singleQuiz ? [item] : [...staged, item];
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

  async function addFiles(files: FileList | File[] | null) {
    let chosen = Array.from(files ?? []);
    if (singleQuiz && chosen.length > 1) {
      pushToast("error", "Only one quiz can be added at a time.", `Reading ${chosen[0].name} and leaving the rest.`);
      chosen = chosen.slice(0, 1);
    }
    for (const file of chosen) {
      const body = new FormData();
      body.append("file", file);
      await read(body, file.name);
    }
    if (fileInput) fileInput.value = "";
  }

  // A file dropped or quiz copied on a library page arrives with the dialog.
  // Read it immediately so the teacher lands on the extracted preview.
  onMount(() => {
    if (initialFiles.length) {
      addFiles(initialFiles);
    } else if (initialText) {
      const body = new FormData();
      body.append("text", initialText);
      read(body, "pasted text");
    }
  });

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

  let dialogEl: HTMLElement;

  function onDrop(event: DragEvent) {
    dragging = false;
    addFiles(event.dataTransfer?.files ?? null);
  }
  // Moving between children fires dragleave, so only a pointer that has actually
  // left the dialog counts as leaving.
  function onDragLeave(event: DragEvent) {
    if (!dialogEl?.contains(event.relatedTarget as Node | null)) dragging = false;
  }
  function removeStaged(id: number) {
    staged = staged.filter((item) => item.id !== id);
  }
  // Only one quiz can go into the quiz being edited, so picking one from a
  // progression puts the others back rather than adding to them.
  function chooseQuiz(itemId: number, quizId: number) {
    staged = staged.map((item) =>
      item.id === itemId ? { ...item, quizzes: item.quizzes.map((quiz) => ({ ...quiz, keep: quiz.id === quizId })) } : item,
    );
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
    // Nothing is filed away when the questions are bound for an open quiz: the
    // editor takes the record and decides what to do with it.
    if (singleQuiz) {
      const item = staged[0];
      const quiz = item?.quizzes.find((entry) => entry.keep);
      if (!quiz) return;
      onImport(quiz.record, item.source);
      onClose();
      return;
    }

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
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  class="import-dialog"
  role="dialog"
  aria-modal="true"
  aria-label={singleQuiz ? "Import questions" : "Import quizzes"}
  tabindex="-1"
  bind:this={dialogEl}
  on:dragover|preventDefault={() => (dragging = true)}
  on:dragleave={onDragLeave}
  on:drop|preventDefault={onDrop}
>
  {#if dragging && staged.length}
    <div class="import-dragover"><strong>Drop to add</strong></div>
  {/if}
  <header class="import-head">
    <h2>{singleQuiz ? "Import questions" : "Import"}</h2>
    <button type="button" class="modal-close" aria-label="Close" on:click={onClose}><Icon name="x" size={16} /></button>
  </header>

  <div class="import-body">
    <!-- The invitation is only worth the room before anything has been added. -->
    {#if !staged.length}
      <div class="import-drop" class:on={dragging}>
        <Icon name="download" size={22} />
        <strong>Drop a PDF here</strong>
        <button type="button" class="ghost-btn" disabled={reading} on:click={() => fileInput.click()}>
          {reading ? "Reading…" : "Choose a file"}
        </button>
        <small>{singleQuiz ? "One quiz goes in at a time — from a progression, pick a step. Pasting works too." : "Drop several at once, or paste a copied quiz."}</small>
      </div>
    {/if}

    <input class="sr-only" type="file" multiple={!singleQuiz} accept="application/pdf,.pdf,application/json,.json" bind:this={fileInput} on:change={() => addFiles(fileInput.files)} />

    {#if staged.length}
      <div class="import-list">
        <div class="import-list-head-row">
          <p class="import-list-head">{singleQuiz ? "Ready to add" : "Ready to import"}</p>
          <button type="button" class="ghost-btn import-add-more" disabled={reading} on:click={() => fileInput.click()}>
            {#if !singleQuiz}<Icon name="plus" size={13} />{/if}
            {reading ? "Reading…" : singleQuiz ? "Choose another" : "Add another"}
          </button>
        </div>
        {#each staged as item (item.id)}
          <div class="import-item">
            <div class="import-item-head">
              <span class="import-kind">{item.kind === "progression" ? "Progression" : "Quiz"}</span>
              <strong>{item.name}</strong>
              <small>from {item.source}</small>
              <button type="button" class="import-drop-item" aria-label={`Remove ${item.name}`} on:click={() => removeStaged(item.id)}><Icon name="x" size={13} /></button>
            </div>

            {#if item.kind === "progression" && !singleQuiz}
              <label class="import-check import-path-check">
                <input type="checkbox" checked={item.keepProgression} on:change={() => togglePath(item.id)} />
                <span>Build the progression itself{item.keepProgression ? "" : " — its quizzes will come in on their own"}</span>
              </label>
            {:else if item.kind === "progression"}
              <p class="import-choose">Choose the step to take questions from</p>
            {/if}

            <div class="import-quizzes">
              {#each item.quizzes as quiz (quiz.id)}
                <!-- With one quiz and nothing to weigh it against, a tickbox only
                     offers a way to make the Import button do nothing. -->
                {#if singleQuiz && item.quizzes.length === 1}
                  <p class="import-count">{describe(quiz.count, "question", "questions")}</p>
                {:else if singleQuiz}
                  <label class="import-check">
                    <input type="radio" name={`step-${item.id}`} checked={quiz.keep} on:change={() => chooseQuiz(item.id, quiz.id)} />
                    <span>{quiz.title}</span>
                    <em>{describe(quiz.count, "question", "questions")}</em>
                  </label>
                {:else}
                  <label class="import-check">
                    <input type="checkbox" checked={quiz.keep} on:change={() => toggleQuiz(item.id, quiz.id)} />
                    <span>{quiz.title}</span>
                    <em>{describe(quiz.count, "question", "questions")}</em>
                  </label>
                {/if}
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
    <button type="button" class="editor-save" disabled={!canImport} on:click={commit}>{importing ? "Importing…" : singleQuiz ? "Add questions" : "Import"}</button>
  </footer>
</div>
