<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import { invalidateAll } from "$app/navigation";
  import { shadeClass } from "$lib/shades";

  type Operation = "multiplication" | "division" | "addition" | "subtraction";
  type Student = { id: string; name: string; loginName: string };
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
  let openAssign: string | null = null;
  let busy = false;
  let error = "";

  let selected = new Set<string>();
  let bulkProgression = "";
  let bulkBusy = false;
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

  async function bulkAssign() {
    if (!bulkProgression || !selected.size) return;
    bulkBusy = true;
    bulkMessage = "";
    error = "";
    try {
      const response = await fetch("/api/enrollments/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ progression: bulkProgression, students: [...selected] }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message);
      await invalidateAll();
      selected = new Set();
      const skipped = result.skipped ? `, ${result.skipped} already assigned` : "";
      bulkMessage = `Assigned ${result.assigned} ${result.assigned === 1 ? "student" : "students"}${skipped}.`;
      bulkProgression = "";
    } catch (caught) { error = caught instanceof Error ? caught.message : "We could not assign these students."; } finally { bulkBusy = false; }
  }

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
    {#if selected.size}
      <div class="bulk-bar" role="region" aria-label="Bulk actions">
        <span class="bulk-count">{selected.size} selected</span>
        <select class="bulk-progression" bind:value={bulkProgression} disabled={bulkBusy} aria-label="Progression to assign">
          <option value="" disabled>Assign a progression…</option>
          {#each data.progressions as progression}<option value={progression.id}>{progression.name} · {progression.stepCount} steps</option>{/each}
        </select>
        <button type="button" class="bulk-assign" disabled={bulkBusy || !bulkProgression} on:click={bulkAssign}>{bulkBusy ? "Assigning…" : "Assign"}</button>
        <button type="button" class="bulk-clear" disabled={bulkBusy} on:click={() => (selected = new Set())}>Clear</button>
      </div>
    {/if}
    {#if bulkMessage}<p class="message success">{bulkMessage}</p>{/if}
    <section class="roster-table" aria-label={`${data.classRoom.name} students`}>
      <div class="roster-table-heading roster-assign-heading"><span class="select-cell"><input type="checkbox" aria-label="Select all students" checked={allSelected} use:setIndeterminate on:change={toggleSelectAll} /></span><span>Student</span><span>Assigned progressions</span></div>
      {#each data.students as student}
        <article class="roster-student roster-assign-row" class:row-selected={selected.has(student.id)}>
          <span class="select-cell"><input type="checkbox" aria-label={`Select ${student.name}`} checked={selected.has(student.id)} on:change={() => toggleStudent(student.id)} /></span>
          <a class="roster-student-name student-detail-link" href={`/teacher/classes/${data.classRoom.id}/students/${student.id}`}><span class="student-avatar">{student.name[0]}</span><div><strong>{student.name}</strong><small>{student.loginName}</small></div></a>
          <div class="assign-cell">
            {#each enrollmentsFor(student.id) as enrollment}
              <span class={`assign-chip ${shadeClass(enrollment.shade, enrollment.operation)}`}><span class="assign-dot"></span><b>{enrollment.name}</b><small>step {enrollment.position}/{enrollment.totalSteps}</small>{#if enrollment.status === "active"}{#if enrollment.released}<span class="attempt-ready"><Icon name="check" size={11} /> Ready</span>{:else}<button type="button" class="attempt-release" disabled={busy} on:click={() => release(enrollment.id)}><Icon name="unlock" size={12} /> Release</button>{/if}{/if}<button type="button" class="assign-remove" aria-label={`Remove ${enrollment.name}`} disabled={busy} on:click={() => unassign(enrollment.id)}><Icon name="x" size={13} /></button></span>
            {/each}
            {#if availableFor(student.id).length}
              <div class="assign-menu" use:closeMenuOutside={student.id}>
                <button type="button" class="assign-add" disabled={busy} on:click|stopPropagation={() => openAssign = openAssign === student.id ? null : student.id}><Icon name="plus" size={14} /> Assign</button>
                {#if openAssign === student.id}
                  <div class="assign-dropdown">
                    {#each availableFor(student.id) as progression}
                      <button type="button" class={shadeClass(progression.shade, progression.operation)} on:click|stopPropagation={() => assign(student.id, progression.id)}><span class="assign-dot"></span>{progression.name}<em>{progression.stepCount} steps</em></button>
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
