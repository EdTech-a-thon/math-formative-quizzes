<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import Icon from "$lib/Icon.svelte";
  import IconGlyph from "$lib/IconGlyph.svelte";
  import { shadeClass, type ShadeId } from "$lib/shades";

  type Step = { id: string; position: number; title: string; questionCount: number };
  type Enrollment = { id: string; studentId: string; studentName: string; currentStep: string; position: number; status: string; released: boolean };
  type Progression = { id: string; name: string; description: string; passPercentage: number; icon: string | null; shade: ShadeId | null };
  type Student = { id: string; name: string; loginName: string };
  export let data: { progression: Progression; steps: Step[]; enrollments: Enrollment[]; students: Student[] };

  $: base = `/teacher/classes/${$page.params.id}/progressions`;
  $: activeEnrollments = data.enrollments.filter((enrollment) => enrollment.status === "active");
  $: waitingCount = activeEnrollments.filter((enrollment) => !enrollment.released).length;
  $: completed = data.enrollments.filter((enrollment) => enrollment.status === "completed");
  $: studentsAt = (stepId: string) => activeEnrollments.filter((enrollment) => enrollment.currentStep === stepId);

  let releasing = "";
  let error = "";
  let message = "";

  // Adding students to this path from here, without going back to the roster.
  let picking = false;
  let chosen = new Set<string>();
  let adding = false;
  $: enrolledIds = new Set(data.enrollments.map((enrollment) => enrollment.studentId));
  $: unassigned = data.students.filter((student) => !enrolledIds.has(student.id));
  $: allChosen = unassigned.length > 0 && chosen.size === unassigned.length;

  function toggleStudent(studentId: string) {
    if (chosen.has(studentId)) chosen.delete(studentId);
    else chosen.add(studentId);
    chosen = chosen;
  }
  function toggleAll() {
    chosen = allChosen ? new Set() : new Set(unassigned.map((student) => student.id));
  }

  async function addStudents() {
    if (!chosen.size) return;
    adding = true;
    error = "";
    message = "";
    try {
      const response = await fetch("/api/enrollments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progression: data.progression.id, students: [...chosen] }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message);
      await invalidateAll();
      message = `${result.assigned} ${result.assigned === 1 ? "student is" : "students are"} now on this path.`;
      chosen = new Set();
      picking = false;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "We could not add these students.";
    } finally {
      adding = false;
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
  <a class="overview-back" href={base}><Icon name="arrow-left" size={14} /> Progressions</a>
  <header class={`progression-overview-header ${shadeClass(data.progression.shade)}`}>
    <div class="overview-title-icon"><IconGlyph name={data.progression.icon || "route"} size={27} fallback="route" /></div>
    <div class="overview-title">
      <p class="eyebrow">PROGRESSION</p>
      <h1>{data.progression.name}</h1>
      <p>{data.progression.description || `${data.steps.length} quizzes in this learning path.`}</p>
      <div class="overview-facts"><span>{data.progression.passPercentage}% to pass</span><span>{data.steps.length} quizzes</span><span>{data.enrollments.length} students</span></div>
    </div>
    <div class="overview-actions">
      <a class="ghost-btn" href={`${base}/${data.progression.id}/edit`}><Icon name="pencil" size={14} /> Edit progression</a>
      <a class="ghost-btn" href={`/api/progressions/${data.progression.id}/pdf`} title="Export this path and all its quizzes as one PDF"><Icon name="upload" size={14} /> Export</a>
      <button class="primary-action" type="button" disabled={!waitingCount || Boolean(releasing)} on:click={releaseAll}>
        <Icon name={waitingCount ? "unlock" : "check"} size={15} />
        {releasing === "all" ? "Releasing…" : waitingCount ? `Release ${waitingCount} waiting` : "Everyone ready"}
      </button>
    </div>
  </header>

  {#if error}<p class="message error">{error}</p>{/if}
  {#if message}<p class="message success">{message}</p>{/if}

  <section class={`add-students-panel ${shadeClass(data.progression.shade)}`}>
    <header>
      <div>
        <h2>Students on this path</h2>
        <p>{data.enrollments.length} of {data.students.length} in this class{unassigned.length ? ` · ${unassigned.length} not added yet` : " · everyone is added"}</p>
      </div>
      {#if unassigned.length}
        <button type="button" class="ghost-btn" on:click={() => { picking = !picking; chosen = new Set(); }}>
          <Icon name={picking ? "x" : "plus"} size={14} /> {picking ? "Cancel" : "Add students"}
        </button>
      {/if}
    </header>
    {#if picking}
      <div class="add-students-toolbar">
        <button type="button" class="ghost-btn" on:click={toggleAll}>{allChosen ? "Clear all" : `Select all ${unassigned.length}`}</button>
        <span>{chosen.size} selected</span>
      </div>
      <div class="add-students-grid">
        {#each unassigned as student}
          <label class:on={chosen.has(student.id)}>
            <input type="checkbox" checked={chosen.has(student.id)} on:change={() => toggleStudent(student.id)} />
            <span class="student-avatar">{student.name[0]}</span>
            <span class="add-student-name"><strong>{student.name}</strong><small>{student.loginName}</small></span>
          </label>
        {/each}
      </div>
      <footer>
        <button class="primary-action" type="button" disabled={!chosen.size || adding} on:click={addStudents}>
          <Icon name="plus" size={15} /> {adding ? "Adding…" : chosen.size ? `Add ${chosen.size} ${chosen.size === 1 ? "student" : "students"}` : "Add students"}
        </button>
      </footer>
    {/if}
  </section>

  <div class="progression-overview-heading"><div><h2>Quiz order and student progress</h2><p>Students appear beside the quiz they are currently working toward.</p></div></div>

  <div class="progression-step-list">
    {#each data.steps as step}
      {@const students = studentsAt(step.id)}
      <section class="progression-step-detail" id={`step-${step.id}`}>
        <div class="step-order"><span>{step.position}</span>{#if step.position < data.steps.length}<i></i>{/if}</div>
        <div class="step-detail-content">
          <header><div><h3>{step.title}</h3><p>{step.questionCount} questions</p></div><span>{students.length} {students.length === 1 ? "student" : "students"}</span></header>
          {#if students.length}
            <div class="step-students">
              {#each students as enrollment}
                <article>
                  <a class="step-student-link" href={`/teacher/classes/${$page.params.id}/students/${enrollment.studentId}`}><span class="student-avatar">{enrollment.studentName[0]}</span><strong>{enrollment.studentName}</strong></a>
                  {#if enrollment.released}
                    <span class="release-status ready"><Icon name="check" size={12} /> Ready</span>
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
</section>
