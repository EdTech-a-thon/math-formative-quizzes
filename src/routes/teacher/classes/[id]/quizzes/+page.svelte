<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import Icon from "$lib/Icon.svelte";
  import IconGlyph from "$lib/IconGlyph.svelte";
  import ImportButton from "$lib/ImportButton.svelte";
  import ImportDropTarget from "$lib/ImportDropTarget.svelte";
  import { shadeClass, type ShadeId } from "$lib/shades";
  import { formatTimeLimit, resolveTimeLimitSeconds } from "$lib/timeLimit";
  import type { Problem } from "$lib/quizProblems";

  type Membership = { id: string; name: string; operation: string; icon: string; shade: string; className: string; thisClass: boolean };
  type Quiz = { id: string; data: { title: string; problems?: Problem[]; timeLimitSeconds?: number; timeLimitMinutes?: number; shade?: ShadeId; icon?: string }; progressions: Membership[] };
  type Usage = Record<string, { progressions: number; attempts: number }>;
  export let data: { quizzes: Quiz[]; usage: Usage };

  $: base = `/teacher/classes/${$page.params.id}/quizzes`;
  let importOpen = false;
  let deletingId: string | null = null;
  let error = "";

  // Downloading through the browser rather than a link, because these cards are
  // already links and a nested one would not be valid.
  function exportQuiz(event: MouseEvent, id: string) {
    event.preventDefault();
    event.stopPropagation();
    window.location.href = `/api/quizzes/${id}/pdf`;
  }

  // The filter only changes which quizzes are listed; the list keeps its
  // progression-membership order underneath. Values are "all", "progression:<id>"
  // or "loose".
  let filter = "all";
  // Progressions in the order the list already puts them in, each with its quiz count.
  $: progressionOptions = data.quizzes
    .flatMap((quiz) => quiz.progressions)
    .reduce((options: (Membership & { count: number })[], progression) => {
      const seen = options.find((option) => option.id === progression.id);
      if (seen) seen.count += 1; else options.push({ ...progression, count: 1 });
      return options;
    }, []);
  $: looseCount = data.quizzes.filter((quiz) => !quiz.progressions.length).length;
  // Deleting the last quiz of a progression takes its pill away with it.
  $: if (filter.startsWith("progression:") && !progressionOptions.some((option) => option.id === filter.slice(12))) filter = "all";
  $: listedQuizzes = data.quizzes.filter((quiz) => {
    if (filter === "all") return true;
    if (filter === "loose") return !quiz.progressions.length;
    return quiz.progressions.some((progression) => progression.id === filter.slice(12));
  });
  $: emptyNote =
    filter === "loose"
      ? "Every one of your quizzes is already in a progression."
      : "This progression has no quizzes yet.";

  // From inside a class, "delete" almost always means "I don't want this in my
  // path" — that lighter action lives on the path editor instead (see
  // ProgressionPreview's remove button) and never reaches this quiz record or
  // any other class. This is the other, rarer action: destroying the quiz
  // record itself, for every class that uses it. So the warning has to spell
  // out exactly how far that reaches — every learning path it's in, every class
  // those paths belong to, and every attempt a student has already sat against
  // it — before it happens, since a delete can't be undone afterwards.
  function deleteWarning(quiz: Quiz): string {
    const title = quiz.data.title || "this quiz";
    const attempts = data.usage[quiz.id]?.attempts ?? 0;
    // Reusing the same membership tags the card itself is built from, rather
    // than recomputing anything: quiz.progressions already names every learning
    // path this quiz is in and the class each one belongs to.
    const pathCount = quiz.progressions.length;
    const classNames = [...new Set(quiz.progressions.map((membership) => membership.className))].sort((a, b) =>
      a.localeCompare(b),
    );

    const lines = [`Delete "${title}"? This cannot be undone.`];
    if (pathCount) {
      const pathWord = pathCount === 1 ? "1 learning path" : `${pathCount} learning paths`;
      const classWord = classNames.length === 1 ? `in ${classNames[0]}` : `across ${classNames.length} classes: ${classNames.join(", ")}`;
      lines.push(`It is used in ${pathWord} ${classWord} — deleting it removes those steps too, from every one of those classes.`);
    }
    if (attempts) {
      lines.push(`Students have ${attempts} recorded attempt${attempts === 1 ? "" : "s"} for this quiz. That history is deleted along with it.`);
    }
    return lines.join("\n\n");
  }

  async function deleteQuiz(event: MouseEvent, quiz: Quiz) {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm(deleteWarning(quiz))) return;
    deletingId = quiz.id; error = "";
    try {
      const response = await fetch(`/api/quizzes/${quiz.id}`, { method: "DELETE" });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.message); }
      await invalidateAll();
    } catch (caught) { error = caught instanceof Error ? caught.message : "We could not delete this quiz."; } finally { deletingId = null; }
  }
</script>

<ImportDropTarget classId={String($page.params.id)} bind:open={importOpen}>
<section class="workspace-page">
  <header class="workspace-heading"><div><p class="eyebrow">QUIZ LIBRARY</p><h1>Quizzes</h1><p>Every quiz you have made. A quiz is shared, so each tag below shows the progressions and classes using it — and editing it changes it for all of them.</p></div><div class="workspace-heading-actions"><ImportButton bind:open={importOpen} /><a class="primary-action" href={`${base}/new`}><Icon name="plus" size={15} /> New quiz</a></div></header>
  {#if error}<p class="message error">{error}</p>{/if}

  {#if data.quizzes.length}
    <div class="picker-filters" role="group" aria-label="Show quizzes in a progression">
      <button type="button" class="filter-pill" class:on={filter === "all"} aria-pressed={filter === "all"} on:click={() => (filter = "all")}>All <span class="pill-count">{data.quizzes.length}</span></button>
      {#each progressionOptions as option (option.id)}
        {@const value = `progression:${option.id}`}
        <button type="button" class={`filter-pill ${shadeClass(option.shade, option.operation)}`} class:on={filter === value} aria-pressed={filter === value} on:click={() => (filter = value)}><i><IconGlyph name={option.icon} fallback="route" size={13} /></i> {option.name}{option.thisClass ? "" : ` · ${option.className}`} <span class="pill-count">{option.count}</span></button>
      {/each}
      {#if looseCount}
        <button type="button" class="filter-pill" class:on={filter === "loose"} aria-pressed={filter === "loose"} on:click={() => (filter = "loose")}>No progression <span class="pill-count">{looseCount}</span></button>
      {/if}
    </div>

    <div class="library-list">
      {#each listedQuizzes as quiz (quiz.id)}
        <a class="library-card" href={`${base}/${quiz.id}`}>
          <span class={`quiz-operation ${shadeClass(quiz.data.shade)}`}><IconGlyph name={quiz.data.icon ?? null} fallback="clipboard-list" size={20} /></span>
          <div class="library-card-body">
            <h2>{quiz.data.title}</h2>
            <p>{(quiz.data.problems ?? []).length} questions{formatTimeLimit(resolveTimeLimitSeconds(quiz.data)) ? ` · ${formatTimeLimit(resolveTimeLimitSeconds(quiz.data))}` : " · no time limit"}</p>
            <div class="card-memberships">
              {#each quiz.progressions as progression}
                <span class={`membership-tag ${shadeClass(progression.shade, progression.operation)}`}><IconGlyph name={progression.icon} fallback="route" size={11} /> {progression.name} <em>{progression.className}</em></span>
              {:else}
                <span class="membership-tag none">Not in a progression</span>
              {/each}
            </div>
          </div>
          <span class="library-edit-hint"><Icon name="pencil" size={14} /> Edit</span>
          <button type="button" class="ghost-btn" title="Export as PDF" on:click={(event) => exportQuiz(event, quiz.id)}><Icon name="upload" size={14} /> Export</button>
          <button
            type="button"
            class="ghost-btn danger"
            disabled={deletingId === quiz.id}
            title="Delete this quiz everywhere it's used — this cannot be undone"
            on:click={(event) => deleteQuiz(event, quiz)}
          >{deletingId === quiz.id ? "Deleting…" : "Delete quiz"}</button>
        </a>
      {:else}
        <p class="editor-note">{emptyNote}</p>
      {/each}
    </div>
  {:else}
    <section class="library-list"><a class="empty-workspace empty-link" href={`${base}/new`}><span><Icon name="clipboard-list" size={22} /></span><h2>No quizzes yet</h2><p>Start with a quiz, then add it to a progression whenever you are ready.</p></a></section>
  {/if}
</section>
</ImportDropTarget>
