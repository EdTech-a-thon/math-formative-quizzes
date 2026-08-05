<script lang="ts">
  import { page } from "$app/stores";
  import Icon from "$lib/Icon.svelte";
  import IconGlyph from "$lib/IconGlyph.svelte";
  import { shadeClass, type ShadeId } from "$lib/shades";

  type Enrollment = { id: string; progressionId: string; currentStep: string; progressionName: string; icon: string | null; shade: ShadeId | null; operation: string; position: number; totalSteps: number; currentQuiz: string; status: string; released: boolean };
  type Attempt = { id: string; title: string; position: number | null; correct: number; total: number; passed: boolean; leveledUp: boolean; completedAt: string };
  export let data: { student: { id: string; name: string; loginName: string }; enrollments: Enrollment[]; attempts: Attempt[] };

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

  <section aria-labelledby="current-progress-title">
    <div class="student-detail-section-heading"><div><h2 id="current-progress-title">Current progress</h2><p>Where {data.student.name} is in each learning path.</p></div><span>{data.enrollments.length} {data.enrollments.length === 1 ? "progression" : "progressions"}</span></div>
    {#if data.enrollments.length}
      <div class="student-progression-grid">
        {#each data.enrollments as enrollment}
          <a class={`student-progression-card ${shadeClass(enrollment.shade, enrollment.operation)}`} href={`/teacher/classes/${$page.params.id}/progressions/${enrollment.progressionId}#${enrollment.status === "completed" ? "completed" : `step-${enrollment.currentStep}`}`}>
            <span class="student-progression-icon"><IconGlyph name={enrollment.icon} fallback="route" size={21} /></span>
            <div class="student-progression-main"><h3>{enrollment.progressionName}</h3>{#if enrollment.status === "completed"}<p>All quizzes completed</p>{:else}<p>{enrollment.currentQuiz}</p>{/if}</div>
            {#if enrollment.status !== "completed"}<span class="student-current-step"><small>STEP</small><strong>{enrollment.position}</strong><em>of {enrollment.totalSteps}</em></span>{/if}
            {#if enrollment.status === "completed"}
              <span class="student-release-state completed"><Icon name="check" size={13} /> Completed</span>
            {:else if enrollment.released}
              <span class="student-release-state released"><Icon name="unlock" size={13} /> Released</span>
            {:else}
              <span class="student-release-state waiting"><Icon name="lock" size={13} /> Waiting</span>
            {/if}
          </a>
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
