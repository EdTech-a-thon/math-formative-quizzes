<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import IconGlyph from "$lib/IconGlyph.svelte";
  import { shadeClass } from "$lib/shades";

  // The one assignment picker the whole app uses. Point it at students or at
  // progressions; either way a teacher searches, ticks as many as they like,
  // and confirms.
  type Item = { id: string; name: string; detail?: string; icon?: string | null; shade?: string; operation?: string };

  export let title: string;
  export let subtitle = "";
  export let kind: "student" | "progression" = "progression";
  export let items: Item[] = [];
  export let busy = false;
  export let error = "";
  export let onClose: () => void;
  export let onConfirm: (ids: string[]) => void;

  let search = "";
  let chosen = new Set<string>();

  $: matches = items.filter((item) => `${item.name} ${item.detail ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  $: allMatchesChosen = matches.length > 0 && matches.every((item) => chosen.has(item.id));
  $: noun = kind === "student" ? "student" : "progression";

  function toggle(id: string) {
    if (chosen.has(id)) chosen.delete(id);
    else chosen.add(id);
    chosen = chosen;
  }

  // "Select all" works on what the search is showing, so a teacher can filter
  // to "Year 4" and take the whole group in one tick.
  function toggleAllMatches() {
    if (allMatchesChosen) for (const item of matches) chosen.delete(item.id);
    else for (const item of matches) chosen.add(item.id);
    chosen = chosen;
  }

  function focusOnOpen(node: HTMLInputElement) {
    node.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && !busy) onClose();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div class="assign-dialog-backdrop" role="presentation" on:click|self={() => !busy && onClose()}>
  <div class="assign-dialog" role="dialog" aria-modal="true" aria-label={title}>
    <header>
      <div><h2>{title}</h2>{#if subtitle}<p>{subtitle}</p>{/if}</div>
      <button type="button" class="assign-dialog-close" aria-label="Close" disabled={busy} on:click={onClose}><Icon name="x" size={18} /></button>
    </header>

    <div class="assign-dialog-search">
      <Icon name="search" size={15} />
      <input use:focusOnOpen bind:value={search} placeholder={`Search ${noun}s…`} aria-label={`Search ${noun}s`} />
    </div>

    <div class="assign-dialog-toolbar">
      <button type="button" class="ghost-btn" disabled={!matches.length} on:click={toggleAllMatches}>
        {allMatchesChosen ? "Clear these" : `Select all ${matches.length}`}
      </button>
      <span>{chosen.size} selected</span>
    </div>

    <div class="assign-dialog-list">
      {#each matches as item (item.id)}
        <label class={`assign-dialog-row ${shadeClass(item.shade, item.operation)}`} class:on={chosen.has(item.id)}>
          <input type="checkbox" checked={chosen.has(item.id)} on:change={() => toggle(item.id)} />
          {#if kind === "student"}
            <span class="student-avatar">{item.name[0]}</span>
          {:else}
            <span class="assign-dialog-icon"><IconGlyph name={item.icon ?? null} fallback="route" size={18} /></span>
          {/if}
          <span class="assign-dialog-name"><strong>{item.name}</strong>{#if item.detail}<small>{item.detail}</small>{/if}</span>
        </label>
      {:else}
        <p class="assign-dialog-empty">{items.length ? `No ${noun}s match “${search}”.` : `Every ${noun} is already assigned.`}</p>
      {/each}
    </div>

    {#if error}<p class="message error">{error}</p>{/if}

    <footer>
      <button type="button" class="ghost-btn" disabled={busy} on:click={onClose}>Cancel</button>
      <button type="button" class="primary-action" disabled={!chosen.size || busy} on:click={() => onConfirm([...chosen])}>
        <Icon name="plus" size={15} />
        {busy ? "Assigning…" : chosen.size ? `Assign ${chosen.size} ${chosen.size === 1 ? noun : `${noun}s`}` : "Assign"}
      </button>
    </footer>
  </div>
</div>

<style>
  .assign-dialog-search input {
    box-shadow: none;
    text-align: left;
  }

  .assign-dialog-search input:focus {
    border: 0;
    box-shadow: none;
  }
</style>
