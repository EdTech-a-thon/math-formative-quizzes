<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import AssignDialog from "$lib/AssignDialog.svelte";
  import { invalidateAll } from "$app/navigation";
  import { shadeClass } from "$lib/shades";
  import { assignmentSummary } from "$lib/assignments";

  type Operation = "multiplication" | "division" | "addition" | "subtraction";
  type Student = { id: string; name: string; loginName: string; accommodations?: { extraTimeMinutes?: number } };
  type Progression = { id: string; name: string; operation: Operation; shade: string; stepCount: number };
  type Enrollment = { id: string; student: string; progression: string; name: string; operation: Operation; shade: string; position: number; totalSteps: number; status: string; released: boolean };

  export let data: {
    classRoom: { id: string; name: string; classCode: string };
    students: Student[];
    progressions: Progression[];
    enrollments: Enrollment[];
  };

  let copied = false;
  let showingClassCode = false;
  let busy = false;
  let error = "";

  let selected = new Set<string>();
  let bulkMessage = "";
  $: allSelected = data.students.length > 0 && selected.size === data.students.length;
  $: someSelected = selected.size > 0 && !allSelected;

  function toggleStudent(studentId: string) {
    if (selected.has(studentId)) selected.delete(studentId);
    else selected.add(studentId);
    selected = selected;
    bulkMessage = "";
  }
  function toggleSelectAll() {
    selected = allSelected ? new Set() : new Set(data.students.map((student) => student.id));
    bulkMessage = "";
  }
  function setIndeterminate(node: HTMLInputElement) {
    const update = () => (node.indeterminate = someSelected);
    update();
    return { update };
  }

  $: enrollmentsFor = (studentId: string) => data.enrollments.filter((item) => item.student === studentId);

  // Accommodations are set on a student's own page; the roster just shows them.
  const extraTimeFor = (student: Student) => Number(student.accommodations?.extraTimeMinutes) || 0;

  // The shared picker, opened either for one row or for everyone ticked. It
  // offers any progression at least one of them is not on yet.
  let assignTo: string[] = [];
  let assignedWholeSelection = false;
  let dialogBusy = false;
  let dialogError = "";
  $: assignChoices = data.progressions
    .filter((progression) => assignTo.some((studentId) => !enrollmentsFor(studentId).some((item) => item.progression === progression.id)))
    .map((progression) => ({
      id: progression.id,
      name: progression.name,
      detail: `${progression.stepCount} ${progression.stepCount === 1 ? "quiz" : "quizzes"}`,
      shade: progression.shade,
      operation: progression.operation,
    }));
  $: assignTitle = assignTo.length === 1
    ? `Assign progressions to ${data.students.find((student) => student.id === assignTo[0])?.name ?? "this student"}`
    : `Assign progressions to ${assignTo.length} students`;

  async function confirmAssign(progressionIds: string[]) {
    dialogBusy = true;
    dialogError = "";
    try {
      const response = await fetch("/api/enrollments/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ students: assignTo, progressions: progressionIds }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message);
      await invalidateAll();
      assignTo = [];
      // Ticked students are only cleared when it was their own Assign button;
      // a single row's button leaves the selection alone.
      if (assignedWholeSelection) selected = new Set();
      bulkMessage = assignmentSummary(result.assigned, result.skipped);
    } catch (caught) { dialogError = caught instanceof Error ? caught.message : "We could not finish these assignments."; } finally { dialogBusy = false; }
  }
  async function unassign(enrollmentId: string) {
    busy = true;
    error = "";
    try {
      const response = await fetch(`/api/enrollments/${enrollmentId}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message);
      await invalidateAll();
    } catch (caught) { error = caught instanceof Error ? caught.message : "We could not remove this assignment."; } finally { busy = false; }
  }
  async function release(enrollmentId: string) {
    busy = true;
    error = "";
    try {
      const response = await fetch(`/api/enrollments/${enrollmentId}`, { method: "PATCH" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message);
      await invalidateAll();
    } catch (caught) { error = caught instanceof Error ? caught.message : "We could not release this attempt."; } finally { busy = false; }
  }

  async function copyClassLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/?classCode=${data.classRoom.classCode}`);
    copied = true;
    window.setTimeout(() => copied = false, 1800);
  }
  function closeWithEscape(event: KeyboardEvent) {
    if (event.key === "Escape") showingClassCode = false;
  }
</script>

<svelte:window on:keydown={closeWithEscape} />

<section class="class-roster" aria-labelledby="class-title">
  <header class="class-roster-header"><div><p class="eyebrow">CLASS ROSTER</p><h1 id="class-title">{data.classRoom.name}</h1><p>{data.students.length} {data.students.length === 1 ? "student" : "students"} · Class code <code>{data.classRoom.classCode}</code></p></div><div class="class-roster-actions"><button class="display-code" type="button" aria-label="Display class code full screen" on:click={() => showingClassCode = true}><Icon name="maximize" size={18} /></button><button class="copy-class-link copy-link-button" type="button" on:click={copyClassLink}><Icon name={copied ? "check" : "copy"} size={16} />{copied ? "Class link copied" : "Copy class link"}</button></div></header>

  {#if error}<p class="message error">{error}</p>{/if}

  {#if data.students.length}
    {#if selected.size}
      <div class="bulk-bar" role="region" aria-label="Bulk actions">
        <span class="bulk-count">{selected.size} selected</span>
        <button type="button" class="bulk-assign" disabled={!data.progressions.length} on:click={() => { assignedWholeSelection = true; assignTo = [...selected]; }}><Icon name="plus" size={15} /> Assign</button>
        <button type="button" class="bulk-clear" on:click={() => (selected = new Set())}>Clear</button>
      </div>
    {/if}
    {#if bulkMessage}<p class="message success">{bulkMessage}</p>{/if}
    <section class="roster-table" aria-label={`${data.classRoom.name} students`}>
      <div class="roster-table-heading roster-assign-heading"><span class="select-cell"><input type="checkbox" aria-label="Select all students" checked={allSelected} use:setIndeterminate on:change={toggleSelectAll} /></span><span>Student</span><span>Assigned progressions</span></div>
      {#each data.students as student}
        <article class="roster-student roster-assign-row" class:row-selected={selected.has(student.id)}>
          <span class="select-cell"><input type="checkbox" aria-label={`Select ${student.name}`} checked={selected.has(student.id)} on:change={() => toggleStudent(student.id)} /></span>
          <a class="roster-student-name student-detail-link" href={`/teacher/classes/${data.classRoom.id}/students/${student.id}`}><span class="student-avatar">{student.name[0]}</span><div><strong>{student.name}</strong><small>{student.loginName}</small></div>{#if extraTimeFor(student)}<span class="accommodation-pill" title={`${extraTimeFor(student)} extra ${extraTimeFor(student) === 1 ? "minute" : "minutes"} on every quiz`}><Icon name="plus" size={11} /><Icon name="clock" size={14} /></span>{/if}</a>
          <div class="assign-cell">
            {#each enrollmentsFor(student.id) as enrollment}
              <span class={`assign-chip ${shadeClass(enrollment.shade, enrollment.operation)}`}><span class="assign-dot"></span><b>{enrollment.name}</b><small>step {enrollment.position}/{enrollment.totalSteps}</small>{#if enrollment.status === "active"}{#if enrollment.released}<span class="attempt-ready"><Icon name="check" size={11} /> Ready</span>{:else}<button type="button" class="attempt-release" disabled={busy} on:click={() => release(enrollment.id)}><Icon name="unlock" size={12} /> Release</button>{/if}{/if}<button type="button" class="assign-remove" aria-label={`Remove ${enrollment.name}`} disabled={busy} on:click={() => unassign(enrollment.id)}><Icon name="x" size={13} /></button></span>
            {/each}
            {#if data.progressions.length}
              <button type="button" class="assign-add" disabled={busy} on:click={() => { assignedWholeSelection = false; assignTo = [student.id]; }}><Icon name="plus" size={14} /> Assign</button>
            {:else}
              <span class="assign-empty">No progressions to assign yet</span>
            {/if}
          </div>
        </article>
      {/each}
    </section>
  {:else}
    <section class="empty-roster"><span><Icon name="users" size={22} /></span><h2>No students yet</h2><p>Learners who join this class will appear here.</p></section>
  {/if}
</section>

{#if assignTo.length}
  <AssignDialog
    title={assignTitle}
    subtitle="Pick as many progressions as you like. Anyone already on one keeps their progress."
    kind="progression"
    items={assignChoices}
    busy={dialogBusy}
    error={dialogError}
    onClose={() => { assignTo = []; dialogError = ""; }}
    onConfirm={confirmAssign}
  />
{/if}

{#if showingClassCode}
  <div class="code-modal" role="dialog" aria-modal="true" aria-label={`${data.classRoom.name} class code`}>
    <button class="close-code-modal" type="button" aria-label="Close class code display" on:click={() => showingClassCode = false}><Icon name="x" size={24} /></button>
    <div class="code-modal-center"><p class="eyebrow">JOIN {data.classRoom.name.toUpperCase()}</p><p class="large-class-code">{data.classRoom.classCode}</p><p>Enter this code at Fact Friends to join the class.</p></div>
    <footer><strong>{data.classRoom.name}</strong><button class="copy-link-button" type="button" on:click={copyClassLink}><Icon name={copied ? "check" : "copy"} size={16} />{copied ? "Class link copied" : "Copy class link"}</button></footer>
  </div>
{/if}
