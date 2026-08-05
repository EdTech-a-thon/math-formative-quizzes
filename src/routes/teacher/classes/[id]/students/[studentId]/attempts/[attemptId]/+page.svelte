<script lang="ts">
  import { page } from "$app/stores";
  import Icon from "$lib/Icon.svelte";

  type Response = { number: number; top: number; bottom: number; symbol: string; submitted: string; correct: boolean; correctAnswer: number };
  type Attempt = { id: string; title: string; progressionName: string; position: number | null; correct: number; total: number; passed: boolean; leveledUp: boolean; completedAt: string; responses: Response[] };
  export let data: { student: { id: string; name: string }; attempt: Attempt };

  $: percentage = data.attempt.total ? Math.round((data.attempt.correct / data.attempt.total) * 100) : 0;
  function whenFinished(completedAt: string) {
    const when = new Date(completedAt.replace(" ", "T"));
    if (Number.isNaN(when.getTime())) return "";
    return when.toLocaleString(undefined, { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }
</script>

<svelte:head><title>{data.attempt.title} review · Fact Friends</title></svelte:head>

<section class="workspace-page attempt-review-page">
  <a class="overview-back" href={`/teacher/classes/${$page.params.id}/students/${data.student.id}`}><Icon name="arrow-left" size={14} /> {data.student.name}</a>

  <header class="attempt-review-header">
    <div><p class="eyebrow">ATTEMPT REVIEW</p><h1>{data.attempt.title}</h1><p>{data.student.name}{data.attempt.progressionName ? ` · ${data.attempt.progressionName}` : ""}{data.attempt.position ? ` · step ${data.attempt.position}` : ""}</p><small>{whenFinished(data.attempt.completedAt)}</small></div>
    <div class="attempt-review-score" class:passed={data.attempt.passed}><strong>{data.attempt.correct}<small>/{data.attempt.total}</small></strong><span>{percentage}% · {data.attempt.passed ? "Passed" : "Not passed"}</span></div>
  </header>

  <div class="attempt-review-heading"><div><h2>Submitted answers</h2><p>Each problem is shown exactly as the student answered it.</p></div><div><span class="review-key correct"><Icon name="check" size={12} /> Correct</span><span class="review-key incorrect"><Icon name="x" size={12} /> Incorrect</span></div></div>

  {#if data.attempt.responses.length}
    <div class="problem-review-list">
      {#each data.attempt.responses as response}
        <article class:correct={response.correct} class:incorrect={!response.correct}>
          <span class="problem-number">{response.number}</span>
          <div class="review-problem"><span>{response.top}</span><b>{response.symbol}</b><span>{response.bottom}</span><i>=</i><strong>{response.submitted || "No answer"}</strong></div>
          <span class="problem-result"><Icon name={response.correct ? "check" : "x"} size={15} /> {response.correct ? "Correct" : "Incorrect"}</span>
          {#if !response.correct}<span class="correct-answer">Correct answer: <strong>{response.correctAnswer}</strong></span>{/if}
        </article>
      {/each}
    </div>
  {:else}
    <p class="student-detail-empty">No problem-by-problem answers were saved for this attempt.</p>
  {/if}
</section>
