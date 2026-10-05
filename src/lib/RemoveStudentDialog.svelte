<script lang="ts">
  import Icon from "$lib/Icon.svelte";

  // Remove a student, either merging their work into another student in the
  // class (for a duplicate student) or deleting it with them. Says exactly
  // what happens before anything is removed; there is no undo.
  export let studentName: string;
  export let pathCount: number;
  export let oneOffCount: number;
  export let attemptCount: number;
  export let classmates: { id: string; name: string }[];
  export let busy = false;
  export let error = "";
  export let onClose: () => void;
  export let onConfirm: (mergeIntoId: string) => void;

  let choice: "merge" | "delete" = classmates.length ? "merge" : "delete";
  let mergeIntoId = "";

  $: keptName = classmates.find((classmate) => classmate.id === mergeIntoId)?.name ?? "";
  $: work = describeWork(pathCount, oneOffCount, attemptCount);
  $: ready = choice === "delete" || Boolean(mergeIntoId);

  function plural(count: number, one: string, many: string) {
    return `${count} ${count === 1 ? one : many}`;
  }

  function describeWork(paths: number, oneOffs: number, attempts: number) {
    const places = [
      paths ? plural(paths, "learning path", "learning paths") : "",
      oneOffs ? plural(oneOffs, "quiz on its own", "quizzes on their own") : "",
    ].filter(Boolean).join(" and ");
    if (!places && !attempts) return "";
    if (!places) return `${studentName} has ${plural(attempts, "quiz attempt", "quiz attempts")}.`;
    return `${studentName} is on ${places}, with ${plural(attempts, "quiz attempt", "quiz attempts")}.`;
  }
</script>

<svelte:window on:keydown={(event) => { if (event.key === "Escape" && !busy) onClose(); }} />

<div class="assign-dialog-backdrop" role="presentation" on:click|self={() => { if (!busy) onClose(); }}>
  <div class="assign-dialog remove-student-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-student-title">
    <header>
      <div><h2 id="remove-student-title">Remove {studentName}?</h2><p>This takes {studentName} off the class roster. It cannot be undone.</p></div>
      <button class="assign-dialog-close" type="button" aria-label="Close" disabled={busy} on:click={onClose}><Icon name="x" size={16} /></button>
    </header>

    {#if work}<p class="remove-student-work">{work}</p>{/if}

    <div class="remove-student-choices">
      {#if classmates.length}
        <label class="assign-dialog-row" class:on={choice === "merge"}>
          <input type="radio" bind:group={choice} value="merge" />
          <span class="assign-dialog-name"><strong>Move their work to another student</strong><small>For a student who signed up twice.</small></span>
        </label>
        {#if choice === "merge"}
          <select class="remove-student-picker" bind:value={mergeIntoId} aria-label="Student to move the work to">
            <option value="">Choose a student…</option>
            {#each classmates as classmate}<option value={classmate.id}>{classmate.name}</option>{/each}
          </select>
          {#if keptName}<p class="remove-student-note">{keptName} keeps their name and accommodations. Where both are on the same learning path, whoever is further along is kept, with every attempt from both.</p>{/if}
        {/if}
      {/if}
      <label class="assign-dialog-row" class:on={choice === "delete"}>
        <input type="radio" bind:group={choice} value="delete" />
        <span class="assign-dialog-name"><strong>Delete their work too</strong><small>Their progress and attempt history are deleted for good.</small></span>
      </label>
    </div>

    {#if error}<p class="message error">{error}</p>{/if}

    <footer>
      <button class="ghost-btn" type="button" disabled={busy} on:click={onClose}>Cancel</button>
      <button class="primary-action danger-action" type="button" disabled={busy || !ready} on:click={() => onConfirm(choice === "merge" ? mergeIntoId : "")}>
        {#if busy}Removing…{:else if choice === "merge"}{keptName ? `Move work to ${keptName} and remove` : "Move work and remove"}{:else}Remove and delete work{/if}
      </button>
    </footer>
  </div>
</div>
