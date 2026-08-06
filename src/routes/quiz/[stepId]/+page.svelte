<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import { applyAction, enhance } from "$app/forms";
  import { onDestroy, onMount } from "svelte";
  import { symbolFor, type Problem } from "$lib/quizProblems";

  export let data: {
    quiz: { title: string; problems: Problem[]; timeLimitMinutes: number; showScore: boolean; passMessage: string };
    progressionName: string;
    position: number;
    totalSteps: number;
    allowIncompleteAnswers: boolean;
    extraTimeMinutes: number;
    timerStorageKey: string;
  };
  export let form: { finished?: boolean; timedOut?: boolean; correct?: number; total?: number; percentage?: number; passed?: boolean; leveledUp?: boolean; finishedProgression?: boolean; nextQuizName?: string; showScore?: boolean; passMessage?: string; progressionName?: string; position?: number; totalSteps?: number; error?: string } | null = null;

  // Exactly the questions the teacher arranged, in their order.
  $: problems = data.quiz.problems;

  let answers: string[] = [];
  // A quiz with no time limit stays untimed, even for a student with extra time.
  const minutesAllowed = data.quiz.timeLimitMinutes ? data.quiz.timeLimitMinutes + data.extraTimeMinutes : 0;
  let secondsLeft = minutesAllowed * 60;
  let handingIn = false;
  let sheet: HTMLFormElement;
  let timeoutSubmit: HTMLButtonElement;
  let ticker = 0;
  let deadline = 0;

  $: answered = problems.filter((_, index) => (answers[index] ?? "").trim() !== "").length;
  $: canHandIn = data.allowIncompleteAnswers || answered === problems.length;
  $: clock = `${Math.floor(Math.max(0, secondsLeft) / 60)}:${String(Math.max(0, secondsLeft) % 60).padStart(2, "0")}`;

  // Time is up: hand the quiz in exactly as it stands.
  onMount(() => {
    if (!secondsLeft) return;

    const savedDeadline = Number(window.localStorage.getItem(data.timerStorageKey));
    deadline = Number.isFinite(savedDeadline) && savedDeadline > 0
      ? savedDeadline
      : Date.now() + secondsLeft * 1000;
    window.localStorage.setItem(data.timerStorageKey, String(deadline));

    updateClock();
    if (!secondsLeft) {
      submitAtTimeout();
      return;
    }
    ticker = window.setInterval(() => {
      updateClock();
      if (secondsLeft <= 0) {
        stopClock();
        submitAtTimeout();
      }
    }, 1000);
  });
  onDestroy(stopClock);
  function updateClock() {
    secondsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  }
  function stopClock() {
    if (ticker) window.clearInterval(ticker);
    ticker = 0;
  }
  function submitAtTimeout() {
    if (handingIn) return;
    sheet.requestSubmit(timeoutSubmit);
  }
  $: if (form?.finished) stopClock();

  // Show the results straight from the hand-in. Reloading the page instead would
  // lose them, because passing this quiz has already moved the student on.
  function handIn() {
    handingIn = true;
    stopClock();
    return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
      handingIn = false;
      if (result.type === "success" || result.type === "failure") {
        form = result.data as typeof form;
        if (form?.finished) window.localStorage.removeItem(data.timerStorageKey);
      }
      else await applyAction(result as Parameters<typeof applyAction>[0]);
    };
  }
</script>

<main class="quiz-page">
  {#if form?.finished}
    <section class="quiz-results" aria-labelledby="results-title">
      <div class="results-badge"><Icon name={form.passed ? "star" : "smile"} size={34} /></div>
      <h1 id="results-title">{form.passed ? form.passMessage : "Nice try!"}</h1>
      {#if form.timedOut}<p class="results-note">Time’s up — your answers were handed in automatically.</p>{/if}
      {#if form.showScore}
        <div class="results-score"><strong>{form.correct}<small>/{form.total}</small></strong><span>correct</span></div>
      {:else}
        <p class="results-note">Your teacher has received your work.</p>
      {/if}
      {#if form.finishedProgression}
        <p class="results-note">You finished {form.progressionName}. Every step is done!</p>
      {:else if form.leveledUp}
        <p class="results-note">Next quiz: {form.nextQuizName}</p>
      {:else}
        <p class="results-note">You’ll need to retake this quiz before moving on. It will stay as your next step.</p>
      {/if}
      <a class="results-home" href="/home">Back to my quizzes <Icon name="arrow-right" size={16} /></a>
    </section>
  {:else}
    <form
      class="quiz-sheet"
      method="POST"
      bind:this={sheet}
      use:enhance={handIn}
    >
      <input type="hidden" name="secondsRemaining" value={Math.max(0, secondsLeft)} />
      <button hidden type="submit" name="timedOut" value="true" bind:this={timeoutSubmit}>Submit timed-out quiz</button>

      <header class="quiz-head">
        <div>
          <p class="eyebrow">{data.progressionName.toUpperCase()} · STEP {data.position} OF {data.totalSteps}</p>
          <h1>{data.quiz.title}</h1>
        </div>
        <div class="quiz-head-side">
          {#if minutesAllowed}
            <span class="quiz-clock" class:low={secondsLeft <= 15}><Icon name="clock" size={16} /> {clock}</span>
          {/if}
          <span class="quiz-progress">{answered} of {problems.length} answered</span>
        </div>
      </header>

      <div class="quiz-grid">
        {#each problems as problem, index}
          <div class="quiz-problem">
            <span class="quiz-num">{index + 1}</span>
            <div class="quiz-stack"><b>{problem.top}</b><b>{symbolFor(problem.op)} {problem.bottom}</b><i></i></div>
            <input
              class="quiz-answer"
              name={`answer-${index}`}
              bind:value={answers[index]}
              inputmode="numeric"
              autocomplete="off"
              aria-label={`Question ${index + 1}: ${problem.top} ${symbolFor(problem.op)} ${problem.bottom}`}
            />
          </div>
        {/each}
      </div>

      {#if form?.error}<p class="message error" role="alert">{form.error}</p>{/if}

      <footer class="quiz-foot">
        {#if !canHandIn}<span class="quiz-foot-note">Answer every question to hand this in.</span>{/if}
        <button class="hand-in" type="submit" disabled={handingIn || !canHandIn}>{handingIn ? "Handing in..." : "Hand in"} <Icon name="arrow-right" size={16} /></button>
      </footer>
    </form>
  {/if}
</main>
