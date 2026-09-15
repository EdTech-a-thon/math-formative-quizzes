<script lang="ts">
  import { goto } from "$app/navigation";
  import Icon from "$lib/Icon.svelte";

  export let data: { defaultClassName: string };

  let name = data.defaultClassName;
  let signupMode: "open" | "closed" = "open";
  let students: { name: string }[] = [{ name: "" }];
  const starterPaths = [
    { key: "addition", title: "Addition", detail: "Add 0–12 · 13 short quizzes" },
    { key: "subtraction", title: "Subtraction", detail: "Subtract with 0–12 · 13 short quizzes" },
    { key: "multiplication", title: "Multiplication", detail: "Multiply by 0–12 · 13 short quizzes" },
    { key: "division", title: "Division", detail: "Divide with 1–12 · 12 short quizzes" },
  ];
  let selectedPaths = new Set<string>(["multiplication"]);
  let error = "";
  let createdClassId = "";
  let pending = false;

  function togglePath(key: string) {
    const next = new Set(selectedPaths);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selectedPaths = next;
  }

  function addStudents(names: string[]) {
    const imported = names.map((studentName) => studentName.trim()).filter(Boolean).map((studentName) => ({ name: studentName }));
    students = [...students.filter((student) => student.name.trim()), ...imported, { name: "" }];
  }

  async function importSpreadsheet(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    addStudents(text.split(/\r?\n|,/));
  }

  async function createClass() {
    error = "";
    pending = true;
    try {
      const response = await fetch("/api/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, signupMode, students: signupMode === "closed" ? students : [], starterPaths: [...selectedPaths] }) });
      const result = await response.json();
      if (result.classRoom?.id) createdClassId = result.classRoom.id;
      if (!response.ok) throw new Error(result.message);
      await goto(`/teacher/classes/${result.classRoom.id}`);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "We could not create this class.";
    } finally { pending = false; }
  }
</script>

<main class="setup-page">
  <a class="brand" href="/teacher/home"><span class="brand-mark">+</span><span>Fact Friends</span></a>
  <section class="class-setup" aria-labelledby="setup-title">
    <a class="back-link" href="/teacher/home"><Icon name="arrow-left" size={14} /> Back to teacher desk</a>
    <p class="eyebrow">NEW CLASS</p><h1 id="setup-title">Set up your class</h1><p class="intro">Name your class, choose a starting practice path, and decide how learners will join. After setup, you can assign paths to students from your class roster.</p>

    <section class="setup-section"><h2>Class details</h2><label for="class-name">Class name</label><input id="class-name" bind:value={name} required /><p class="code-note">A unique six-digit class code will be created when you finish setup.</p></section>

    <section class="setup-section"><h2>Choose ready-made practice</h2><p class="section-help">Select as many math-fact paths as your class needs. You can also build your own quizzes later.</p><div class="starter-path-grid">{#each starterPaths as path}<button type="button" class={`starter-path op-${path.key}`} class:chosen={selectedPaths.has(path.key)} aria-pressed={selectedPaths.has(path.key)} on:click={() => togglePath(path.key)}><span class="starter-path-symbol">{path.key === "addition" ? "+" : path.key === "subtraction" ? "−" : path.key === "multiplication" ? "×" : "÷"}</span><span><strong>{path.title}</strong><small>{path.detail}</small></span><span class="starter-path-check" aria-hidden="true">{selectedPaths.has(path.key) ? "✓" : ""}</span></button>{/each}</div></section>

    <section class="setup-section"><h2>How will learners join?</h2><div class="mode-grid"><button type="button" class:chosen={signupMode === "open"} on:click={() => signupMode = "open"}><strong>Open sign-up</strong><small>Learners enter the class code and add their own name.</small></button><button type="button" class:chosen={signupMode === "closed"} on:click={() => signupMode = "closed"}><strong>Use a roster</strong><small>Only learners you add to the class can sign in.</small></button></div></section>

    {#if signupMode === "closed"}
      <section class="setup-section"><h2>Class roster</h2><p class="section-help">Type names, paste a list, or upload a simple spreadsheet with one name per row.</p><div class="roster-actions"><label class="upload"><input type="file" accept=".csv,.txt" on:change={importSpreadsheet} />Upload spreadsheet</label><button type="button" class="paste-button" on:click={() => { const pasted = window.prompt("Paste student names, one per line or separated by commas."); if (pasted) addStudents(pasted.split(/\r?\n|,/)); }}>Paste names</button></div>{#each students as student, index}<div class="student-row student-row-simple"><input bind:value={student.name} placeholder="Student's first and last name" /><button type="button" class="remove" aria-label="Remove learner" on:click={() => students = students.filter((_, itemIndex) => itemIndex !== index)}><Icon name="x" size={16} /></button></div>{/each}<button type="button" class="add-student" on:click={() => students = [...students, { name: "" }]}><Icon name="plus" size={15} /> Add another learner</button></section>
    {/if}
    {#if error}<p class="message error" role="alert">{error}{#if createdClassId} Your class was created. <a href={`/teacher/classes/${createdClassId}`}>Open it to continue.</a>{/if}</p>{/if}
    <button class="create-class" type="button" disabled={pending || Boolean(createdClassId)} on:click={createClass}>{pending ? "Setting up your class..." : "Create class and continue"} <span><Icon name="arrow-right" size={17} /></span></button>
  </section>
</main>
