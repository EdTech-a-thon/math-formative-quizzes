<script lang="ts">
  import Icon from "$lib/Icon.svelte";

  // The dialog itself belongs to the page's ImportDropTarget, so a drop, a paste
  // and this button all bring up the same one.
  export let open = false;
  export let label = "Import";
</script>

<button type="button" class="ghost-btn" on:click={() => (open = true)}>
  <Icon name="download" size={14} /> {label}
</button>
