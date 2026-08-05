<script lang="ts">
  import { page } from "$app/stores";
  import { invalidateAll } from "$app/navigation";
  import Icon from "$lib/Icon.svelte";
  import IconGlyph from "$lib/IconGlyph.svelte";
  import AssignDialog from "$lib/AssignDialog.svelte";
  import { shadeClass, type ShadeId } from "$lib/shades";
  import { assignmentSummary } from "$lib/assignments";

  type Enrollment = { id: string; progressionId: string; currentStep: string; progressionName: string; icon: string | null; shade: ShadeId | null; operation: string; position: number; totalSteps: number; currentQuiz: string; status: string; released: boolean };
  type Attempt = { id: string; title: string; position: number | null; correct: number; total: number; passed: boolean; leveledUp: boolean; completedAt: string };
  type Progression = { id: string; name: string; operation: string; shade: string; stepCount: number };
  export let data: { student: { id: string; name: string; loginName: string }; enrollments: Enrollment[]; attempts: Attempt[]; progressions: Progression[] };

  let busy = "";
  let error = "";
  let message = "";

  // The same picker as everywhere else, offering the paths this student is not
  // on yet.
  let picking = false;
  let dialogBusy = false;
  let dialogError = "";
  $: available = data.progressions
    .filter((progression) => !data.enrollments.some((enrollment) => enrollment.progressionId === progression.id))
    .map((progression) => ({
      id: progression.id,
      name: progression.name,
      detail: `${progression.stepCount} ${progression.stepCount === 1 ? "quiz" : "quizzes"}`,
      shade: progression.shade,
      operation: progression.operation,
    }));

  async function assign(progressionIds: string[]) {
    dialogBusy = true;
    dialogError = "";
    message = "";
    try {
      const response = await fetch("/api/enrollments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: [data.student.id], progressions: progressionIds }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message);
      await invalidateAll();
      picking = false;
      message = assignmentSummary(result.assigned, result.skipped);
    } catch (caught) {
      dialogError = caught instanceof Error ? caught.message : "We could not assign these progressions.";
    } finally {
      dialogBusy = false;
    }
  }

  async function release(enrollment: Enrollment) {
    busy = enrollment.id;
    error = "";
    message = "";
    try {
      const response = await fetch(`/api/enrollments/${enrollment.id}`, { method: "PATCH" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message);
      await invalidateAll();
      message = `${data.student.name} can start their next attempt in ${enrollment.progressionName}.`;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "We could not release this attempt.";
    } finally {
      busy = "";
    }
  }

  function whenFinished(completedAt: string) {
    const when = new Date(completedAt.replace(" ", "T"));
    if (Number.isNaN(when.getTime())) return "";
    return when.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function percentage(attempt: Attempt) {
    return attempt.total ? Math.round((attempt.correct / attempt.total) * 100) : 0;
  }
</script>

<svelte:head><title>{data.student.name} · Fact Friends</title></svelte:head>

<section class="workspace-page student-detail-page">
  <a class="overview-back" href={`/teacher/classes/${$page.params.id}`}><Icon name="arrow-left" size={14} /> Class roster</a>
  <header class="student-detail-header">
    <span class="student-detail-avatar">{data.student.name[0]}</span>
    <div><p class="eyebrow">STUDENT PROGRESS</p><h1>{data.student.name}</h1><p>{data.student.loginName}</p></div>
  </header>

  {#if error}<p class="message error">{error}</p>{/if}
  {#if message}<p class="message success">{message}</p>{/if}

  <section aria-labelledby="current-progress-title">
    <div class="student-detail-section-heading">
      <div><h2 id="current-progress-title">Current progress</h2><p>Where {data.student.name} is in each learning path.</p></div>
      <div class="student-detail-heading-actions">
        <span>{data.enrollments.length} {data.enrollments.length === 1 ? "progression" : "progressions"}</span>
        {#if data.progressions.length}<button type="button" class="assign-open" on:click={() => (picking = true)}><Icon name="plus" size={15} /> Assign</button>{/if}
      </div>
    </div>
    {#if data.enrollments.length}
      <div class="student-progression-grid">
        {#each data.enrollments as enrollment}
          <article class={`student-progression-card ${shadeClass(enrollment.shade, enrollment.operation)}`}>
            <a class="student-progression-link" href={`/teacher/classes/${$page.params.id}/progressions/${enrollment.progressionId}#${enrollment.status === "completed" ? "completed" : `step-${enrollment.currentStep}`}`}>
              <span class="student-progression-icon"><IconGlyph name={enrollment.icon} fallback="route" size={21} /></span>
              <div class="student-progression-main"><h3>{enrollment.progressionName}</h3>{#if enrollment.status === "completed"}<p>All quizzes completed</p>{:else}<p>{enrollment.currentQuiz}</p>{/if}</div>
              {#if enrollment.status !== "completed"}<span class="student-current-step"><small>STEP</small><strong>{enrollment.position}</strong><em>of {enrollment.totalSteps}</em></span>{/if}
            </a>
            {#if enrollment.status === "completed"}
              <span class="student-release-state completed"><Icon name="check" size={13} /> Completed</span>
            {:else if enrollment.released}
              <span class="student-release-state ready"><Icon name="check" size={13} /> Ready</span>
            {:else}
              <span class="student-release-state waiting"><Icon name="lock" size={13} /> Waiting</span>
              <button class="student-release-button" type="button" disabled={Boolean(busy)} on:click={() => release(enrollment)}>
                <Icon name="unlock" size={13} /> {busy === enrollment.id ? "Releasing…" : "Release"}
              </button>
            {/if}
          </article>
        {/each}
      </div>
    {:else}
      <p class="student-detail-empty">No progressions have been assigned to this student.</p>
    {/if}

  </section>

  <section class="student-attempts" aria-labelledby="attempt-history-title">
    <div class="student-detail-section-heading"><div><h2 id="attempt-history-title">Attempt history</h2><p>Every quiz attempt, newest first.</p></div><span>{data.attempts.length} {data.attempts.length === 1 ? "attempt" : "attempts"}</span></div>
    {#if data.attempts.length}
      <div class="teacher-attempt-list">
        {#each data.attempts as attempt}
          <a class="teacher-attempt-row" href={`/teacher/classes/${$page.params.id}/students/${data.student.id}/attempts/${attempt.id}`}>
            <span class="attempt-result-icon" class:passed={attempt.passed}><Icon name={attempt.passed ? "check" : "rotate-ccw"} size={15} /></span>
            <div class="attempt-quiz"><strong>{attempt.title}</strong><small>{whenFinished(attempt.completedAt)}{attempt.position ? ` · step ${attempt.position}` : ""}</small></div>
            <span class="attempt-score">{attempt.correct}/{attempt.total}<small>{percentage(attempt)}%</small></span>
            <span class="attempt-outcome" class:passed={attempt.passed}>{attempt.leveledUp ? "Passed · moved up" : attempt.passed ? "Passed" : "Needs another attempt"}</span>
            <Icon name="arrow-right" size={14} />
          </a>
        {/each}
      </div>
    {:else}
      <p class="student-detail-empty">This student has not completed an attempt yet.</p>
    {/if}
  </section>
</section>

{#if picking}
  <AssignDialog
    title={`Assign progressions to ${data.student.name}`}
    subtitle="Pick as many as you like. They start at the first quiz in each one."
    kind="progression"
    items={available}
    busy={dialogBusy}
    error={dialogError}
    onClose={() => { picking = false; dialogError = ""; }}
    onConfirm={assign}
  />
{/if}
