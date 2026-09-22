<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import Icon from "$lib/Icon.svelte";
  import IconGlyph from "$lib/IconGlyph.svelte";
  import AssignDialog from "$lib/AssignDialog.svelte";
  import { shadeClass, type ShadeId } from "$lib/shades";
  import { assignmentSummary, sendToStepSummary } from "$lib/assignments";

  type Step = { id: string; quizId: string; position: number; title: string; questionCount: number };
  type Enrollment = { id: string; studentId: string; studentName: string; currentStep: string; position: number; status: string; released: boolean };
  type Progression = { id: string; name: string; description: string; passPercentage: number; oneAtATime: boolean; showAnswers: boolean; selfPaced: boolean; icon: string | null; shade: ShadeId | null };
  type Student = { id: string; name: string; loginName: string };
  export let data: { progression: Progression; steps: Step[]; enrollments: Enrollment[]; students: Student[] };

  $: base = `/teacher/classes/${$page.params.id}/progressions`;
  $: activeEnrollments = data.enrollments.filter((enrollment) => enrollment.status === "active");
  $: waitingCount = activeEnrollments.filter((enrollment) => !enrollment.released).length;
  $: completed = data.enrollments.filter((enrollment) => enrollment.status === "completed");
  $: studentsAt = (stepId: string) => activeEnrollments.filter((enrollment) => enrollment.currentStep === stepId);

  let releasing = "";
  let deleting = false;

  // Says exactly what goes and what stays before anything is removed.
  function deleteWarning() {
    const lines = [`Delete "${data.progression.name}"? This cannot be undone.`];
    const students = data.enrollments.length;
    if (students) lines.push(`${students} ${students === 1 ? "student is" : "students are"} on this path. Their place on it and their attempt history for it will be deleted.`);
    lines.push("The quizzes stay in your quiz library.");
    return lines.join("\n\n");
  }

  async function deletePath() {
    if (!confirm(deleteWarning())) return;
    deleting = true;
    error = "";
    try {
      const response = await fetch(`/api/progressions/${data.progression.id}`, { method: "DELETE" });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.message); }
      await goto(base);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "We could not delete this learning path.";
      deleting = false;
    }
  }
  let error = "";
  let message = "";

  // The same picker the roster uses, pointed at students instead of paths.
  let picking = false;
  let dialogBusy = false;
  let dialogError = "";
  $: enrolledIds = new Set(data.enrollments.map((enrollment) => enrollment.studentId));
  $: unassigned = data.students
    .filter((student) => !enrolledIds.has(student.id))
    .map((student) => ({ id: student.id, name: student.name, detail: student.loginName, shade: data.progression.shade ?? "" }));

  async function assignStudents(studentIds: string[]) {
    dialogBusy = true;
    dialogError = "";
    message = "";
    try {
      const response = await fetch("/api/enrollments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progressions: [data.progression.id], students: studentIds }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message);
      await invalidateAll();
      picking = false;
      message = assignmentSummary(result.assigned, result.skipped);
    } catch (caught) {
      dialogError = caught instanceof Error ? caught.message : "We could not add these students.";
    } finally {
      dialogBusy = false;
    }
  }

  // Sending students straight to one quiz in this path. The same picker again,
  // but this time the whole class is on offer: a student who has never been on
  // this path joins it here, and one who is already on it moves here.
  let sending: Step | null = null;
  $: enrollmentByStudent = new Map(data.enrollments.map((enrollment) => [enrollment.studentId, enrollment]));
  $: stepTitleById = new Map(data.steps.map((step) => [step.id, step.title]));
  // Where each student stands today, so the teacher can see who she is moving.
  $: sendCandidates = (step: Step) =>
    data.students.map((student) => {
      const enrollment = enrollmentByStudent.get(student.id);
      let detail = "not on this path yet";
      if (enrollment?.status === "completed") detail = "finished this path";
      else if (enrollment?.currentStep === step.id) detail = "already on this quiz";
      else if (enrollment) detail = `on ${stepTitleById.get(enrollment.currentStep) ?? "this path"}`;
      return { id: student.id, name: student.name, detail, shade: data.progression.shade ?? "" };
    });

  async function sendToStep(studentIds: string[]) {
    const step = sending;
    if (!step) return;
    dialogBusy = true;
    dialogError = "";
    message = "";
    try {
      const response = await fetch("/api/enrollments/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progression: data.progression.id, step: step.id, students: studentIds }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message);
      await invalidateAll();
      sending = null;
      message = sendToStepSummary(result.moved, step.title);
    } catch (caught) {
      dialogError = caught instanceof Error ? caught.message : "We could not move these students.";
    } finally {
      dialogBusy = false;
    }
  }

  async function releaseOne(enrollment: Enrollment) {
    releasing = enrollment.id;
    error = "";
    message = "";
    try {
      const response = await fetch(`/api/enrollments/${enrollment.id}`, { method: "PATCH" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message);
      await invalidateAll();
      message = `${enrollment.studentName} is ready for their next attempt.`;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "We could not release this attempt.";
    } finally {
      releasing = "";
    }
  }

  async function releaseAll() {
    const students = `${waitingCount} ${waitingCount === 1 ? "student" : "students"}`;
    if (!confirm(`Release the next attempt in ${data.progression.name} for ${students}?\n\nThey will be able to start their quizzes right away.`)) return;
    releasing = "all";
    error = "";
    message = "";
    try {
      const response = await fetch("/api/enrollments/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progression: data.progression.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message);
      await invalidateAll();
      message = `${result.released} ${result.released === 1 ? "student is" : "students are"} ready for their next attempt.`;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "We could not release these attempts.";
    } finally {
      releasing = "";
    }
  }
</script>

<svelte:head><title>{data.progression.name} · Fact Friends</title></svelte:head>

<section class="workspace-page progression-overview">
  <a class="overview-back" href={base}><Icon name="arrow-left" size={14} /> Learning paths</a>
  <header class={`progression-overview-header ${shadeClass(data.progression.shade)}`}>
    <div class="overview-title-icon"><IconGlyph name={data.progression.icon || "route"} size={27} fallback="route" /></div>
    <div class="overview-title">
      <p class="eyebrow">LEARNING PATH</p>
      <h1>{data.progression.name}</h1>
      <p>{data.progression.description || `${data.steps.length} quizzes in this learning path.`}</p>
      <div class="overview-facts"><span>{data.progression.passPercentage}% to pass</span><span>{data.steps.length} quizzes</span><span>{data.enrollments.length} students</span><span>{data.progression.oneAtATime ? "one question at a time" : "all questions at once"}</span><span>{data.progression.showAnswers ? "answers shown" : "answers hidden"}</span><span>{data.progression.selfPaced ? "self-paced" : "teacher released"}</span></div>
    </div>
    <div class="overview-actions">
      <a class="ghost-btn" href={`${base}/${data.progression.id}/edit`}><Icon name="pencil" size={14} /> Edit learning path</a>
      <a class="ghost-btn" href={`/api/progressions/${data.progression.id}/pdf`} title="Export this path and all its quizzes as one PDF"><Icon name="upload" size={14} /> Export</a>
      {#if !data.progression.selfPaced}
        <button class="primary-action" type="button" disabled={!waitingCount || Boolean(releasing)} on:click={releaseAll}>
          <Icon name={waitingCount ? "unlock" : "check"} size={15} />
          {releasing === "all" ? "Releasing…" : waitingCount ? `Release ${waitingCount} waiting` : "Everyone ready"}
        </button>
      {/if}
    </div>
  </header>

  {#if error}<p class="message error">{error}</p>{/if}
  {#if message}<p class="message success">{message}</p>{/if}

  <section class="add-students-panel">
    <div>
      <h2>Students on this path</h2>
      <p>{data.enrollments.length} of {data.students.length} in this class{unassigned.length ? ` · ${unassigned.length} not added yet` : " · everyone is added"}</p>
    </div>
    {#if data.students.length}
      <button type="button" class="assign-open" on:click={() => (picking = true)}><Icon name="plus" size={15} /> Assign</button>
    {/if}
  </section>

  <div class="progression-overview-heading"><div><h2>Quiz order and student progress</h2><p>Students appear beside the quiz they are currently working toward.</p></div></div>

  <div class="progression-step-list">
    {#each data.steps as step}
      {@const students = studentsAt(step.id)}
      <section class="progression-step-detail" id={`step-${step.id}`}>
        <div class="step-order"><span>{step.position}</span>{#if step.position < data.steps.length}<i></i>{/if}</div>
        <div class="step-detail-content">
          <header>
            <a class="step-quiz-link" href={`/teacher/classes/${$page.params.id}/quizzes/${step.quizId}`} title="Open this quiz">
              <h3>{step.title}</h3>
              <p>{step.questionCount} questions</p>
            </a>
            <div class="step-header-side">
              <span>{students.length} {students.length === 1 ? "student" : "students"}</span>
              {#if data.students.length}
                <button type="button" class="step-send-button" on:click={() => (sending = step)}><Icon name="arrow-right" size={12} /> Send students here</button>
              {/if}
            </div>
          </header>
          {#if students.length}
            <div class="step-students">
              {#each students as enrollment}
                <article>
                  <a class="step-student-link" href={`/teacher/classes/${$page.params.id}/students/${enrollment.studentId}`}><span class="student-avatar">{enrollment.studentName[0]}</span><strong>{enrollment.studentName}</strong></a>
                  {#if enrollment.released}
                    <span class="release-status ready"><Icon name="check" size={12} /> Ready</span>
                  {:else if data.progression.selfPaced}
                    <span class="release-status ready"><Icon name="unlock" size={12} /> Opens automatically</span>
                  {:else}
                    <span class="release-status waiting"><Icon name="lock" size={12} /> Waiting</span>
                    <button type="button" disabled={Boolean(releasing)} on:click={() => releaseOne(enrollment)}><Icon name="unlock" size={12} /> {releasing === enrollment.id ? "Releasing…" : "Release"}</button>
                  {/if}
                </article>
              {/each}
            </div>
          {:else}
            <p class="step-no-students">No students are at this quiz right now.</p>
          {/if}
        </div>
      </section>
    {/each}
  </div>

  {#if completed.length}
    <section class="progression-completed" id="completed"><h2><Icon name="check" size={17} /> Completed</h2><div class="completed-student-links">{#each completed as student}<a href={`/teacher/classes/${$page.params.id}/students/${student.studentId}`}>{student.studentName}</a>{/each}</div></section>
  {/if}
  <footer class="overview-delete">
    <p>Done with this learning path? Deleting it removes students' progress on it. The quizzes stay in your quiz library.</p>
    <button class="ghost-btn danger" type="button" disabled={deleting} on:click={deletePath}>{deleting ? "Deleting…" : "Delete learning path"}</button>
  </footer>
</section>

{#if picking}
  <AssignDialog
    title={`Assign students to ${data.progression.name}`}
    subtitle="Everyone you pick starts at the first quiz in this path."
    kind="student"
    items={unassigned}
    busy={dialogBusy}
    error={dialogError}
    onClose={() => { picking = false; dialogError = ""; }}
    onConfirm={assignStudents}
  />
{/if}

{#if sending}
  <AssignDialog
    title={`Send students to ${sending.title}`}
    subtitle="Everyone you pick goes straight to this quiz and can start it right away."
    kind="student"
    verb="Send"
    busyLabel="Sending…"
    confirmIcon="arrow-right"
    items={sendCandidates(sending)}
    busy={dialogBusy}
    error={dialogError}
    onClose={() => { sending = null; dialogError = ""; }}
    onConfirm={sendToStep}
  />
{/if}
