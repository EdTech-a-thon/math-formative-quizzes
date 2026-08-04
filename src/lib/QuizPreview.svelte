<script lang="ts">
  import { buildProblems, type Operation } from "$lib/quizProblems";
  import Icon from "$lib/Icon.svelte";

  export let title = "";
  export let operation: Operation = "multiplication";
  export let factGroups: { group: number; questions: number }[] = [];
  export let questionCount = 0;
  export let timeLimitMinutes = 2;
  export let showScore = true;
  export let seed: number | null = null;
  export let passMessage = "";
  export let highlightGroup: number | null = null;

  const CAP = 90; // Cap how many we actually render in the preview.

  // Faithful to the real quiz: every question shown at once on one worksheet.
  $: problems = buildProblems(operation, factGroups, { cap: CAP, seed });
  $: hiddenCount = Math.max(0, questionCount - problems.length);
  $: minutes = Math.max(0, Math.floor(timeLimitMinutes));

  let mode: "quiz" | "results" = "quiz";
  $: sampleScore = Math.max(1, Math.round(questionCount * 0.85));
</script>

<aside class="qp op-{operation}" aria-label="Student preview">
  <div class="qp-frame-label"><span><Icon name="circle-dot" size={12} /></span> Live student preview</div>
  <div class="qp-tabs" role="tablist">
    <button type="button" role="tab" aria-selected={mode === "quiz"} class:on={mode === "quiz"} on:click={() => (mode = "quiz")}>The worksheet</button>
    <button type="button" role="tab" aria-selected={mode === "results"} class:on={mode === "results"} on:click={() => (mode = "results")}>Finished screen</button>
  </div>

  <div class="qp-phone">
    <div class="qp-notch"></div>
    {#if mode === "quiz"}
      <div class="qp-screen">
        <header class="qp-head">
          <strong>{title.trim() || "Untitled quiz"}</strong>
          <span class="qp-meta">
            <span class="qp-count">{questionCount} question{questionCount === 1 ? "" : "s"}</span>
            <span class="qp-timer"><Icon name="clock" size={13} /> {minutes}:00</span>
          </span>
        </header>
        {#if problems.length}
          <div class="qp-grid" class:has-hl={highlightGroup != null}>
            {#each problems as problem, index}
              <div class="wp-problem" class:hl={problem.group === highlightGroup}>
                <span class="wp-num">{index + 1}</span>
                <div class="wp-stack"><b>{problem.top}</b><b>{problem.sym} {problem.bottom}</b><i></i></div>
                <span class="wp-blank"></span>
              </div>
            {/each}
          </div>
          {#if hiddenCount}<p class="qp-more">+ {hiddenCount} more question{hiddenCount === 1 ? "" : "s"} on the page</p>{/if}
        {:else}
          <div class="qp-empty-problem">Pick a fact group to fill the worksheet.</div>
        {/if}
      </div>
    {:else}
      <div class="qp-screen qp-results">
        <div class="qp-badge"><Icon name="star" size={32} /></div>
        <p class="qp-pass">{passMessage.trim() || "Great work! You finished this quiz."}</p>
        {#if showScore}
          <div class="qp-score-circle"><strong>{sampleScore}<small>/{questionCount || 0}</small></strong><span>correct</span></div>
        {:else}
          <p class="qp-noscore">Your teacher has received your work.</p>
        {/if}
        <span class="qp-next">Back to my quizzes <Icon name="arrow-right" size={15} /></span>
      </div>
    {/if}
  </div>
  <p class="qp-foot">Every question appears at once, just like the real quiz.</p>
</aside>
