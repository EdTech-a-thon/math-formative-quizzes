<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import { shades, type ShadeId } from "$lib/shades";

  export let shade: ShadeId | null = null;
  export let label = "Colour";
  // The colour a card falls back to when no shade is chosen (the operation's own).
  export let defaultLabel = "Match the operation";
  export let onPick: (shade: ShadeId | null) => void = () => {};
</script>

<div class="shade-picker" role="group" aria-label={label}>
  <button type="button" class="shade-swatch shade-swatch-auto" class:on={!shade} aria-pressed={!shade} title={defaultLabel} aria-label={defaultLabel} on:click={() => onPick(null)}>
    {#if !shade}<Icon name="check" size={13} />{/if}
  </button>
  {#each shades as option (option.id)}
    <button
      type="button"
      class="shade-swatch"
      class:on={shade === option.id}
      style={`--swatch: ${option.color}; --swatch-soft: ${option.soft};`}
      aria-pressed={shade === option.id}
      title={option.label}
      aria-label={option.label}
      on:click={() => onPick(option.id)}
    >
      {#if shade === option.id}<Icon name="check" size={13} />{/if}
    </button>
  {/each}
</div>
