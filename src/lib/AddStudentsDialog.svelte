<script lang="ts">
  import Icon from "$lib/Icon.svelte";

  export let busy = false;
  export let error = "";
  export let onClose: () => void;
  export let onConfirm: (names: string[]) => void;

  let namesText = "";
  let fileInput: HTMLInputElement;

  $: names = namesText.split(/\r?\n|,/).map((name) => name.trim()).filter(Boolean);

  function focusOnOpen(node: HTMLTextAreaElement) {
    node.focus();
  }

  async function importNames(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const imported = (await file.text()).split(/\r?\n|,/).map((name) => name.trim()).filter(Boolean);
    namesText = [...names, ...imported].join("\n");
    fileInput.value = "";
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && !busy) onClose();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div class="assign-dialog-backdrop" role="presentation" on:click|self={() => !busy && onClose()}>
  <div class="assign-dialog add-students-dialog" role="dialog" aria-modal="true" aria-labelledby="add-students-title">
    <header>
      <div><h2 id="add-students-title">Add students</h2><p>Enter one name per line, or upload a simple roster.</p></div>
      <button type="button" class="assign-dialog-close" aria-label="Close" disabled={busy} on:click={onClose}><Icon name="x" size={18} /></button>
    </header>

    <label for="student-names">Student names</label>
    <textarea id="student-names" use:focusOnOpen bind:value={namesText} rows="8" placeholder={'Alex Morgan\nSam Taylor\nJordan Lee'} disabled={busy}></textarea>
    <div class="add-students-tools">
      <input class="sr-only" type="file" accept=".csv,.txt" bind:this={fileInput} on:change={importNames} />
      <button type="button" class="ghost-btn" disabled={busy} on:click={() => fileInput.click()}><Icon name="upload" size={14} /> Upload roster</button>
      <span>{names.length} {names.length === 1 ? "student" : "students"} ready</span>
    </div>

    {#if error}<p class="message error" role="alert">{error}</p>{/if}

    <footer>
      <button type="button" class="ghost-btn" disabled={busy} on:click={onClose}>Cancel</button>
      <button type="button" class="primary-action" disabled={!names.length || busy} on:click={() => onConfirm(names)}><Icon name="plus" size={15} /> {busy ? "Adding…" : names.length === 1 ? "Add student" : `Add ${names.length} students`}</button>
    </footer>
  </div>
</div>
