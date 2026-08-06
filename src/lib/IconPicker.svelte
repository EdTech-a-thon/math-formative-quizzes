<script lang="ts">
  // The icon and colour a quiz or progression wears. The trigger sits beside the
  // title in the editor, and everything — shade first, then the icon grid — is
  // chosen inside the one popup.
  import Icon from "$lib/Icon.svelte";
  import IconGlyph from "$lib/IconGlyph.svelte";
  import ShadePicker from "$lib/ShadePicker.svelte";
  import type { IconName } from "$lib/icons";
  import { pickerIconNames } from "$lib/pickerIcons";
  import type { ShadeId } from "$lib/shades";

  export let name: string | null = null;
  export let shade: ShadeId | null = null;
  export let fallback: IconName = "circle-dot"; // Drawn while nothing is chosen.
  export let title = "Icon and colour";
  export let defaultShadeLabel = "Match the operation";
  export let compact = false; // Card-sized trigger rather than the editor's title-sized one.
  export let onChange: (next: { name: string | null; shade: ShadeId | null }) => void = () => {};

  let open = false;
  let search = "";
  let searchInput: HTMLInputElement | undefined;

  $: query = search.trim().toLowerCase().replace(/\s+/g, "-");
  $: matches = query ? pickerIconNames.filter((item) => item.includes(query)) : pickerIconNames;

  async function toggle() {
    open = !open;
    if (!open) return;
    search = "";
    await Promise.resolve();
    searchInput?.focus();
  }
</script>

<div class="icon-picker">
  <button type="button" class="icon-picker-trigger" class:compact aria-expanded={open} aria-haspopup="dialog" aria-label={title} title={title} on:click|preventDefault|stopPropagation={toggle}>
    <IconGlyph {name} {fallback} size={compact ? 18 : 21} />
  </button>

  {#if open}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="icon-picker-backdrop" role="presentation" on:click={() => (open = false)}></div>
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div class="icon-picker-panel" role="dialog" aria-label={title} on:keydown={(event) => event.key === "Escape" && (open = false)}>
      <div class="icon-picker-shades">
        <ShadePicker {shade} defaultLabel={defaultShadeLabel} onPick={(picked) => onChange({ name, shade: picked })} />
        <div class="icon-picker-actions">
          {#if name}<button type="button" class="icon-picker-clear" on:click={() => onChange({ name: null, shade })}>Reset</button>{/if}
          <button type="button" class="icon-picker-done" on:click={() => (open = false)}>Done</button>
        </div>
      </div>

      <div class="icon-picker-search">
        <Icon name="search" size={14} />
        <input bind:this={searchInput} bind:value={search} placeholder="Search icons…" aria-label="Search icons" spellcheck="false" />
      </div>

      {#if matches.length}
        <div class="icon-picker-grid">
          {#each matches as item (item)}
            <button type="button" class="icon-picker-option" class:on={item === name} title={item} aria-label={item} aria-pressed={item === name} on:click={() => onChange({ name: item, shade })}>
              <IconGlyph name={item} size={19} />
            </button>
          {/each}
        </div>
      {:else}
        <p class="icon-picker-note">No icon matches “{search.trim()}”.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .icon-picker-search:focus-within {
    border-color: var(--operation, #7456e8);
    box-shadow: 0 0 0 3px var(--operation-soft, #eee9ff);
  }
</style>
