<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import { applyAction, enhance } from "$app/forms";
  import { onDestroy, onMount } from "svelte";
  import { symbolFor, type Problem } from "$lib/quizProblems";

  export let data: {
    quiz: { title: string; problems: Problem[]; timeLimitMinutes: number; showScore: boolean; oneAtATime: boolean; passMessage: string };
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
  // One-at-a-time quizzes keep every question in the page, so a hand-in still
  // carries all the answers; only one of them is on screen at any moment.
  $: oneAtATime = data.quiz.oneAtATime;
  let current = 0;
  let fields: HTMLInputElement[] = [];
  $: lastQuestion = current >= problems.length - 1;

  function goTo(index: number) {
    current = Math.min(Math.max(0, index), problems.length - 1);
    // Land in the answer box, so a student can keep typing without reaching for the mouse.
    setTimeout(() => fields[current]?.focus(), 0);
  }
  // Enter moves on rather than handing the quiz in early.
  function onAnswerKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" || !oneAtATime || lastQuestion) return;
    event.preventDefault();
    goTo(current + 1);
  }

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
      </header>

      <!-- The clock rides along at the top of the screen, so a student can always
           see how long is left without scrolling back up. -->
      <div class="quiz-status-bar">
        {#if minutesAllowed}
          <span class="quiz-clock" class:low={secondsLeft <= 15}><Icon name="clock" size={16} /> {clock}</span>
        {/if}
        <span class="quiz-progress">{answered} of {problems.length} answered</span>
      </div>

      <div class="quiz-grid" class:one-at-a-time={oneAtATime}>
        {#each problems as problem, index}
          <div class="quiz-problem" class:showing={!oneAtATime || index === current}>
            <span class="quiz-num">{index + 1}</span>
            <div class="quiz-stack"><b>{problem.top}</b><b>{symbolFor(problem.op)} {problem.bottom}</b><i></i></div>
            <input
              class="quiz-answer"
              name={`answer-${index}`}
              bind:value={answers[index]}
              bind:this={fields[index]}
              on:keydown={onAnswerKeydown}
              inputmode="numeric"
              autocomplete="off"
              aria-label={`Question ${index + 1}: ${problem.top} ${symbolFor(problem.op)} ${problem.bottom}`}
            />
          </div>
        {/each}
      </div>

      {#if form?.error}<p class="message error" role="alert">{form.error}</p>{/if}

      <footer class="quiz-foot">
        {#if oneAtATime}
          <button class="quiz-back" type="button" disabled={current === 0} on:click={() => goTo(current - 1)}><Icon name="arrow-left" size={16} /> Back</button>
          <span class="quiz-foot-note">Question {current + 1} of {problems.length}</span>
        {/if}
        {#if oneAtATime && !lastQuestion}
          <button class="hand-in" type="button" on:click={() => goTo(current + 1)}>Next <Icon name="arrow-right" size={16} /></button>
        {:else}
          {#if !canHandIn}<span class="quiz-foot-note">Answer every question to hand this in.</span>{/if}
          <button class="hand-in" type="submit" disabled={handingIn || !canHandIn}>{handingIn ? "Handing in..." : "Hand in"} <Icon name="arrow-right" size={16} /></button>
        {/if}
      </footer>
    </form>
  {/if}
</main>
