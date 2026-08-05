<script lang="ts">
  export let data: { teacher: { name: string }; classes: { id: string; name: string; classCode: string; studentCount: number }[] };
  import { goto, invalidateAll } from "$app/navigation";
  import Icon from "$lib/Icon.svelte";
  type ClassCard = { id: string; name: string; classCode: string; studentCount: number };
  let displayedClass: { name: string; classCode: string } | null = null;
  let openMenu: string | null = null;
  let copied = false;
  let deletingId: string | null = null;

  async function deleteClass(classRoom: ClassCard) {
    openMenu = null;
    const warning = `Delete "${classRoom.name}"? This permanently removes the class along with its ${classRoom.studentCount} student${classRoom.studentCount === 1 ? "" : "s"}, quizzes, and progressions. This cannot be undone.`;
    if (!confirm(warning)) return;
    deletingId = classRoom.id;
    try {
      const response = await fetch(`/api/classes/${classRoom.id}`, { method: "DELETE" });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.message || "We could not delete this class."); }
      await invalidateAll();
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "We could not delete this class.");
    } finally { deletingId = null; }
  }

  async function signOut() {
    await fetch("/api/teacher-auth", { method: "DELETE" });
    await goto("/teacher");
  }

  function openClass(event: MouseEvent, classId: string) {
    if ((event.target as Element).closest("button, a")) return;
    const href = `/teacher/classes/${classId}`;
    if (event.ctrlKey || event.metaKey || event.button === 1) {
      window.open(href, "_blank", "noopener");
      return;
    }
    goto(href);
  }

  async function copyClassLink(classRoom = displayedClass) {
    if (!classRoom) return;
    await navigator.clipboard.writeText(`${window.location.origin}/?classCode=${classRoom.classCode}`);
    copied = true;
    openMenu = null;
    window.setTimeout(() => copied = false, 1800);
  }

  function closeWithEscape(event: KeyboardEvent) {
    if (event.key === "Escape") {
      displayedClass = null;
      openMenu = null;
    }
  }

  function closeMenuOutside(node: HTMLElement, classId: string) {
    function handleClick(event: MouseEvent) {
      if (openMenu === classId && !node.contains(event.target as Node)) openMenu = null;
    }

    document.addEventListener("click", handleClick);
    return { destroy: () => document.removeEventListener("click", handleClick) };
  }
</script>

<svelte:window on:keydown={closeWithEscape} />

<main>
  <a class="brand" href="/teacher/home"><span class="brand-mark">+</span><span>Fact Friends</span></a>
  <section class="teacher-dashboard" aria-labelledby="teacher-home-title">
    <header class="dashboard-header"><div><p class="eyebrow">TEACHER DESK</p><h1 id="teacher-home-title">Welcome, {data.teacher.name.split(" ")[0]}.</h1><p>Manage your classes and help learners practice math facts.</p></div><button class="sign-out" type="button" on:click={signOut}>Sign out</button></header>
    <section class="class-list" aria-label="Your classes">
      <div class="class-list-heading"><div><p class="eyebrow">YOUR CLASSES</p><h2>{data.classes.length === 1 ? "1 class" : `${data.classes.length} classes`}</h2></div><a class="button-link" href="/teacher/classes/new"><Icon name="plus" size={16} /> New class</a></div>
      {#if data.classes.length}
        <div class="class-card-grid">{#each data.classes as classRoom}<article class="class-card clickable-class-card" on:click={(event) => openClass(event, classRoom.id)} on:auxclick={(event) => openClass(event, classRoom.id)}><a class="class-card-open-link" href={`/teacher/classes/${classRoom.id}`} aria-label={`Open ${classRoom.name}`}></a><div class="class-card-link"><div class="class-card-icon">{classRoom.name[0]}</div><div><h3>{classRoom.name}</h3><p><span class="student-count">{classRoom.studentCount} {classRoom.studentCount === 1 ? "student" : "students"}</span></p></div></div><div class="class-card-side"><div class="class-card-actions"><button class="display-code" type="button" aria-label={`Display ${classRoom.name} class code`} on:click|stopPropagation={() => { displayedClass = classRoom; copied = false; }}><Icon name="maximize" size={17} /></button><div class="class-menu" use:closeMenuOutside={classRoom.id}><button class="class-menu-trigger" type="button" aria-label={`More options for ${classRoom.name}`} aria-expanded={openMenu === classRoom.id} on:click|stopPropagation={() => openMenu = openMenu === classRoom.id ? null : classRoom.id}><Icon name="more-vertical" size={18} /></button>{#if openMenu === classRoom.id}<div class="class-menu-dropdown"><button class="copy-link-button" type="button" on:click|stopPropagation={() => copyClassLink(classRoom)}><Icon name={copied ? "check" : "copy"} size={15} />{copied ? "Class link copied" : "Copy class link"}</button><button type="button" class="menu-danger" disabled={deletingId === classRoom.id} on:click|stopPropagation={() => deleteClass(classRoom)}>{deletingId === classRoom.id ? "Deleting…" : "Delete class"}</button></div>{/if}</div></div><p class="class-code-label">Class code <code>{classRoom.classCode}</code></p></div></article>{/each}</div>
      {:else}
        <a class="empty-classes empty-link" href="/teacher/classes/new"><span><Icon name="plus" size={22} /></span><h2>No classes yet</h2><p>Create your first class to help learners begin practicing math facts.</p></a>
      {/if}
    </section>
  </section>
</main>

{#if displayedClass}
  <div class="code-modal" role="dialog" aria-modal="true" aria-label={`${displayedClass.name} class code`}>
    <button class="close-code-modal" type="button" aria-label="Close class code display" on:click={() => displayedClass = null}><Icon name="x" size={24} /></button>
    <div class="code-modal-center"><p class="eyebrow">JOIN {displayedClass.name.toUpperCase()}</p><p class="large-class-code">{displayedClass.classCode}</p><p>Enter this code at Fact Friends to join the class.</p></div>
    <footer><strong>{displayedClass.name}</strong><button class="copy-link-button" type="button" on:click={() => copyClassLink()}><Icon name={copied ? "check" : "copy"} size={16} />{copied ? "Class link copied" : "Copy class link"}</button></footer>
  </div>
{/if}
