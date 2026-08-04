<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import { invalidateAll } from "$app/navigation";

  type Operation = "multiplication" | "division" | "addition" | "subtraction";
  type Student = { id: string; name: string; loginName: string };
  type Progression = { id: string; name: string; operation: Operation; stepCount: number };
  type Enrollment = { id: string; student: string; progression: string; name: string; operation: Operation; position: number; totalSteps: number };

  export let data: {
    classRoom: { name: string; classCode: string };
    students: Student[];
    progressions: Progression[];
    enrollments: Enrollment[];
  };

  let copied = false;
  let showingClassCode = false;
  let openAssign: string | null = null;
  let busy = false;
  let error = "";

  $: enrollmentsFor = (studentId: string) => data.enrollments.filter((item) => item.student === studentId);
  $: availableFor = (studentId: string) => {
    const taken = new Set(enrollmentsFor(studentId).map((item) => item.progression));
    return data.progressions.filter((progression) => !taken.has(progression.id));
  };

  async function assign(studentId: string, progressionId: string) {
    openAssign = null;
    busy = true;
    error = "";
    try {
      const response = await fetch("/api/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student: studentId, progression: progressionId }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message);
      await invalidateAll();
    } catch (caught) { error = caught instanceof Error ? caught.message : "We could not assign this student."; } finally { busy = false; }
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

  async function copyClassLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/?classCode=${data.classRoom.classCode}`);
    copied = true;
    window.setTimeout(() => copied = false, 1800);
  }
  function closeWithEscape(event: KeyboardEvent) {
    if (event.key === "Escape") { showingClassCode = false; openAssign = null; }
  }
  function closeMenuOutside(node: HTMLElement, studentId: string) {
    function handleClick(event: MouseEvent) {
      if (openAssign === studentId && !node.contains(event.target as Node)) openAssign = null;
    }
    document.addEventListener("click", handleClick);
    return { destroy: () => document.removeEventListener("click", handleClick) };
  }
</script>

<svelte:window on:keydown={closeWithEscape} />

<section class="class-roster" aria-labelledby="class-title">
  <header class="class-roster-header"><div><p class="eyebrow">CLASS ROSTER</p><h1 id="class-title">{data.classRoom.name}</h1><p>{data.students.length} {data.students.length === 1 ? "student" : "students"} · Class code <code>{data.classRoom.classCode}</code></p></div><div class="class-roster-actions"><button class="display-code" type="button" aria-label="Display class code full screen" on:click={() => showingClassCode = true}><Icon name="maximize" size={18} /></button><button class="copy-class-link copy-link-button" type="button" on:click={copyClassLink}><Icon name={copied ? "check" : "copy"} size={16} />{copied ? "Class link copied" : "Copy class link"}</button></div></header>

  {#if error}<p class="message error">{error}</p>{/if}

  {#if data.students.length}
    <section class="roster-table" aria-label={`${data.classRoom.name} students`}>
      <div class="roster-table-heading roster-assign-heading"><span>Student</span><span>Assigned progressions</span></div>
      {#each data.students as student}
        <article class="roster-student roster-assign-row">
          <div class="roster-student-name"><span class="student-avatar">{student.name[0]}</span><div><strong>{student.name}</strong><small>{student.loginName}</small></div></div>
          <div class="assign-cell">
            {#each enrollmentsFor(student.id) as enrollment}
              <span class={`assign-chip op-${enrollment.operation}`}><span class="assign-dot"></span><b>{enrollment.name}</b><small>step {enrollment.position}/{enrollment.totalSteps}</small><button type="button" class="assign-remove" aria-label={`Remove ${enrollment.name}`} disabled={busy} on:click={() => unassign(enrollment.id)}><Icon name="x" size={13} /></button></span>
            {/each}
            {#if availableFor(student.id).length}
              <div class="assign-menu" use:closeMenuOutside={student.id}>
                <button type="button" class="assign-add" disabled={busy} on:click|stopPropagation={() => openAssign = openAssign === student.id ? null : student.id}><Icon name="plus" size={14} /> Assign</button>
                {#if openAssign === student.id}
                  <div class="assign-dropdown">
                    {#each availableFor(student.id) as progression}
                      <button type="button" class={`op-${progression.operation}`} on:click|stopPropagation={() => assign(student.id, progression.id)}><span class="assign-dot"></span>{progression.name}<em>{progression.stepCount} steps</em></button>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else if !enrollmentsFor(student.id).length}
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

{#if showingClassCode}
  <div class="code-modal" role="dialog" aria-modal="true" aria-label={`${data.classRoom.name} class code`}>
    <button class="close-code-modal" type="button" aria-label="Close class code display" on:click={() => showingClassCode = false}><Icon name="x" size={24} /></button>
    <div class="code-modal-center"><p class="eyebrow">JOIN {data.classRoom.name.toUpperCase()}</p><p class="large-class-code">{data.classRoom.classCode}</p><p>Enter this code at Fact Friends to join the class.</p></div>
    <footer><strong>{data.classRoom.name}</strong><button class="copy-link-button" type="button" on:click={copyClassLink}><Icon name={copied ? "check" : "copy"} size={16} />{copied ? "Class link copied" : "Copy class link"}</button></footer>
  </div>
{/if}
