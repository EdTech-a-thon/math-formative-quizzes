<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import IconGlyph from "$lib/IconGlyph.svelte";
  import { shadeClass } from "$lib/shades";

  type Assigned = { stepId: string; progressionName: string; position: number; totalSteps: number; title: string; icon: string; shade: string; questionCount: number; timeLimitMinutes: number; released: boolean };
  type Finished = { id: string; title: string; icon: string; shade: string; correct: number; total: number; passed: boolean; leveledUp: boolean; completedAt: string };

  export let data: { studentName: string; className: string; forYou: Assigned[]; history: Finished[] };

  // PocketBase hands dates over as "2026-08-04 14:30:00.000Z".
  function whenFinished(completedAt: string) {
    const when = new Date(completedAt.replace(" ", "T"));
    if (Number.isNaN(when.getTime())) return "";
    return when.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
</script>

<main class="student-page">
  <a class="brand" href="/home" aria-label="Fact Friends home"><span class="brand-mark">+</span><span>Fact Friends</span></a>
  <form class="student-sign-out" method="POST" action="?/signOut"><button type="submit">Not you?</button></form>

  <div class="student-home">
    <header class="student-greeting">
      <p class="eyebrow">YOUR PRACTICE</p>
      <h1>Hello {data.studentName}</h1>
      <p>{data.className}</p>
    </header>

    <section aria-labelledby="for-you-title">
      <div class="student-section-heading"><h2 id="for-you-title">For you</h2><p>Practice your teacher lined up.</p></div>
      {#if data.forYou.length}
        <div class="assigned-grid">
          {#each data.forYou as assigned}
            <article class={`assigned-card ${shadeClass(assigned.shade)}`} class:attempt-waiting={!assigned.released}>
              <span class="assigned-symbol"><IconGlyph name={assigned.icon || null} fallback="clipboard-list" size={22} /></span>
              <h3>{assigned.title}</h3>
              <p class="assigned-path">{assigned.progressionName} · step {assigned.position} of {assigned.totalSteps}</p>
              <p class="assigned-meta">{assigned.questionCount} questions{assigned.timeLimitMinutes ? ` · ${assigned.timeLimitMinutes} min` : ""}</p>
              {#if assigned.released}
                <a class="start-quiz" href="/quiz/{assigned.stepId}">Start quiz <Icon name="arrow-right" size={16} /></a>
              {:else}
                <p class="waiting-for-release"><Icon name="lock" size={15} /> Waiting for your teacher</p>
              {/if}
            </article>
          {/each}
        </div>
      {:else}
        <p class="student-empty">Nothing to practice just yet. Your teacher will send something soon.</p>
      {/if}
    </section>

    <section aria-labelledby="history-title">
      <div class="student-section-heading"><h2 id="history-title">History</h2><p>Quizzes you have finished.</p></div>
      {#if data.history.length}
        <div class="history-list">
          {#each data.history as finished}
            <article class={`history-row ${shadeClass(finished.shade)}`}>
              <span class="history-symbol"><IconGlyph name={finished.icon || null} fallback="clipboard-list" size={18} /></span>
              <div class="history-name"><strong>{finished.title}</strong><small>{whenFinished(finished.completedAt)}</small></div>
              <span class="history-score">{finished.correct}/{finished.total}</span>
              <span class="history-badge" class:passed={finished.passed}>
                <Icon name={finished.passed ? "check" : "circle-dot"} size={13} />
                {finished.leveledUp ? "Moved up" : finished.passed ? "Passed" : "Keep practicing"}
              </span>
            </article>
          {/each}
        </div>
      {:else}
        <p class="student-empty">Your finished quizzes will show up here.</p>
      {/if}
    </section>
  </div>
</main>
