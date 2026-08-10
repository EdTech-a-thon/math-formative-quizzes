<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import IconGlyph from "$lib/IconGlyph.svelte";
  import { shadeClass } from "$lib/shades";

  type Question = { number: number; top: number; bottom: number; symbol: string; answer: string; correct: boolean; correctAnswer: number };
  export let data: {
    attempt: { title: string; icon: string; shade: string; progressionName: string; correct: number; total: number; passed: boolean; completedAt: string; questions: Question[] };
  };

  $: missed = data.attempt.questions.filter((question) => !question.correct);

  // PocketBase hands dates over as "2026-08-04 14:30:00.000Z".
  function whenFinished(completedAt: string) {
    const when = new Date(completedAt.replace(" ", "T"));
    if (Number.isNaN(when.getTime())) return "";
    return when.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }
</script>

<svelte:head><title>{data.attempt.title} · Fact Friends</title></svelte:head>

<main class="student-page">
  <a class="brand" href="/home" aria-label="Fact Friends home"><span class="brand-mark">+</span><span>Fact Friends</span></a>

  <div class="student-home">
    <a class="overview-back" href="/home"><Icon name="arrow-left" size={14} /> My quizzes</a>

    <header class={`student-review-head ${shadeClass(data.attempt.shade)}`}>
      <span class="history-symbol"><IconGlyph name={data.attempt.icon || null} fallback="clipboard-list" size={22} /></span>
      <div>
        <h1>{data.attempt.title}</h1>
        <p>{data.attempt.progressionName} · {whenFinished(data.attempt.completedAt)}</p>
      </div>
      <div class="results-score"><strong>{data.attempt.correct}<small>/{data.attempt.total}</small></strong><span>correct</span></div>
    </header>

    {#if missed.length}
      <section class="study-list" aria-labelledby="study-title">
        <h2 id="study-title">Study up on</h2>
        {#each missed as question}
          <p>
            <b>{question.top} {question.symbol} {question.bottom} = {question.correctAnswer}</b>
            <span>You answered: {question.answer || "nothing"}</span>
          </p>
        {/each}
      </section>
    {:else}
      <p class="student-empty">You got every question right on this one. Nothing to study!</p>
    {/if}

    <section aria-labelledby="all-answers-title">
      <div class="student-section-heading"><h2 id="all-answers-title">Every question</h2><p>What you wrote for each one.</p></div>
      <div class="student-answer-list">
        {#each data.attempt.questions as question}
          <article class:correct={question.correct} class:incorrect={!question.correct}>
            <span class="problem-number">{question.number}</span>
            <div class="review-problem"><span>{question.top}</span><b>{question.symbol}</b><span>{question.bottom}</span><i>=</i><strong>{question.answer || "—"}</strong></div>
            <span class="problem-result"><Icon name={question.correct ? "check" : "x"} size={15} /> {question.correct ? "Correct" : "Incorrect"}</span>
            {#if !question.correct}<span class="correct-answer">Right answer: <strong>{question.correctAnswer}</strong></span>{/if}
          </article>
        {/each}
      </div>
    </section>
  </div>
</main>
