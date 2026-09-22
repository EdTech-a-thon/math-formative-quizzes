<script lang="ts">
  import { page } from "$app/stores";
  import Icon from "$lib/Icon.svelte";
  export let data: { classRoom: { id: string; name: string; classCode: string } };
  $: base = `/teacher/classes/${data.classRoom.id}`;
  $: current = $page.url.pathname;
  let copied = false;
  let showingClassCode = false;
  let showingHelp = false;

  async function copyClassLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/?classCode=${data.classRoom.classCode}`);
    copied = true;
    window.setTimeout(() => copied = false, 1800);
  }

  function closeWithEscape(event: KeyboardEvent) {
    if (event.key === "Escape") {
      showingClassCode = false;
      showingHelp = false;
    }
  }
</script>

<svelte:window on:keydown={closeWithEscape} />

<div class="class-workspace">
  <aside class="class-sidebar">
    <a class="workspace-brand" href="/teacher/home"><span class="brand-mark">+</span> Fact Friends</a>
    <a class="back-to-classes" href="/teacher/home"><Icon name="arrow-left" size={13} /> All classes</a>
    <div class="class-switcher"><span>{data.classRoom.name[0]}</span><div><strong>{data.classRoom.name}</strong><small>Class code {data.classRoom.classCode}</small></div><div class="sidebar-code-actions"><button type="button" aria-label="Display class code full screen" on:click={() => showingClassCode = true}><Icon name="maximize" size={15} /></button><button type="button" aria-label="Copy class link" on:click={copyClassLink}>{#if copied}<Icon name="check" size={15} />{:else}<Icon name="copy" size={15} />{/if}</button></div></div>
    <nav aria-label="Class pages">
      <a class:active={current === base} href={base}><span><Icon name="users" size={17} /></span> Roster</a>
      <a class:active={current.startsWith(`${base}/quizzes`)} href={`${base}/quizzes`}><span><Icon name="clipboard-list" size={17} /></span> Quizzes</a>
      <a class:active={current.startsWith(`${base}/progressions`)} href={`${base}/progressions`}><span><Icon name="route" size={17} /></span> Learning paths</a>
    </nav>
    <button class="sidebar-help" type="button" aria-label="Help" aria-haspopup="dialog" on:click={() => showingHelp = true}><Icon name="circle-question-mark" size={22} /></button>
  </aside>
  <main class="workspace-content"><slot /></main>
</div>

{#if showingClassCode}
  <div class="code-modal" role="dialog" aria-modal="true" aria-label={`${data.classRoom.name} class code`}>
    <button class="close-code-modal" type="button" aria-label="Close class code display" on:click={() => showingClassCode = false}><Icon name="x" size={24} /></button>
    <div class="code-modal-center"><p class="eyebrow">JOIN {data.classRoom.name.toUpperCase()}</p><p class="large-class-code">{data.classRoom.classCode}</p><p>Enter this code at Fact Friends to join the class.</p></div>
    <footer><strong>{data.classRoom.name}</strong><button class="copy-link-button" type="button" on:click={copyClassLink}><Icon name={copied ? "check" : "copy"} size={16} />{copied ? "Class link copied" : "Copy class link"}</button></footer>
  </div>
{/if}

{#if showingHelp}
  <div class="help-dialog-backdrop" role="presentation" on:click|self={() => showingHelp = false}>
    <div class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-dialog-title" tabindex="-1">
      <header><h2 id="help-dialog-title">Need a hand?</h2><button type="button" aria-label="Close help" on:click={() => showingHelp = false}><Icon name="x" size={18} /></button></header>
      <p>If you are running into trouble or have suggestions, email us at <a href="mailto:support@factfriends.com?subject=Fact%20Friends%20help">support@factfriends.com</a>.</p>
    </div>
  </div>
{/if}
